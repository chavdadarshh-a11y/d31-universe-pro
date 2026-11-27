/**
 * Range-of-motion (ROM / depth) levels for every exercise in the library — data-driven.
 * Each family lists its levels from shortest to fullest range. Where a joint angle tells the depth
 * (knee for squats, elbow for push-ups/pull-ups…), `metric` + `cut` let the camera / Analyze estimate
 * the level reached: level i is reached when the measured angle is at or beyond cut[i].
 */
import type { Exercise, Lang } from '../types'
import { allExercises } from './exercises'

export type L3 = { en: string; hi: string; gu: string }
export type RomLevel = { id: string; name: L3; desc: L3 }
/** knee/hip/elbow/shoulder = smallest joint angle seen (smaller = deeper); shoulderUp = arm raise angle (bigger = higher) */
export type RomMetric = 'kneeMin' | 'hip' | 'elbowMin' | 'shoulder'
export type RomFamily = { id: string; levels: RomLevel[]; metric?: RomMetric; cut?: number[]; higherIsDeeper?: boolean }

const l = (en: string, hi: string, gu: string): L3 => ({ en, hi, gu })
const lv = (id: string, name: L3, desc: L3): RomLevel => ({ id, name, desc })

export const ROM_FAMILIES: Record<string, RomFamily> = {
  squat: { id: 'squat', metric: 'kneeMin', cut: [140, 100, 75], levels: [
    lv('quarter', l('Quarter', 'क्वार्टर', 'ક્વાર્ટર'), l('Knees bend about 45°, hips stay high.', 'घुटने लगभग 45° मुड़ें, हिप्स ऊपर रहें।', 'ઘૂંટણ આશરે 45° વળે, હિપ્સ ઊંચા રહે.')),
    lv('parallel', l('Parallel', 'पैरेलल', 'પેરેલલ'), l('Thighs level with the floor (knee ≈ 90°).', 'जांघें ज़मीन के बराबर (घुटना ≈ 90°)।', 'જાંઘ જમીનને સમાંતર (ઘૂંટણ ≈ 90°).')),
    lv('deep', l('Deep / ATG', 'डीप / ATG', 'ડીપ / ATG'), l('Hips below knees, ass to grass, heels down.', 'हिप्स घुटनों से नीचे, पूरा नीचे, एड़ी ज़मीन पर।', 'હિપ્સ ઘૂંટણથી નીચે, પૂરું નીચે, એડી જમીન પર.')),
  ] },
  lunge: { id: 'lunge', metric: 'kneeMin', cut: [135, 100, 80], levels: [
    lv('short', l('Short', 'शॉर्ट', 'શોર્ટ'), l('Back knee stops well above the floor.', 'पीछे का घुटना ज़मीन से काफ़ी ऊपर रुकता है।', 'પાછળનો ઘૂંટણ જમીનથી ઘણો ઉપર અટકે.')),
    lv('ninety', l('90 / 90', '90 / 90', '90 / 90'), l('Both knees about 90°, back knee hovers.', 'दोनों घुटने लगभग 90°, पीछे का घुटना हवा में।', 'બંને ઘૂંટણ આશરે 90°, પાછળનો ઘૂંટણ હવામાં.')),
    lv('deep', l('Deep', 'डीप', 'ડીપ'), l('Back knee kisses the floor, front knee travels past toes.', 'पीछे का घुटना ज़मीन छुए, आगे का घुटना पंजों से आगे।', 'પાછળનો ઘૂંટણ જમીનને અડે, આગળનો ઘૂંટણ પંજાથી આગળ.')),
  ] },
  pistol: { id: 'pistol', metric: 'kneeMin', cut: [120, 90, 60], levels: [
    lv('box', l('To box', 'बॉक्स तक', 'બોક્સ સુધી'), l('Sit down to a box or bench.', 'बॉक्स या बेंच तक बैठें।', 'બોક્સ કે બેન્ચ સુધી બેસો.')),
    lv('parallel', l('Parallel', 'पैरेलल', 'પેરેલલ'), l('Working thigh level with the floor.', 'काम करती जांघ ज़मीन के बराबर।', 'કામ કરતી જાંઘ જમીનને સમાંતર.')),
    lv('full', l('Full pistol', 'फुल पिस्टल', 'ફુલ પિસ્ટલ'), l('Hamstring rests on calf at the bottom.', 'नीचे हैमस्ट्रिंग पिंडली पर टिके।', 'નીચે હેમસ્ટ્રિંગ પિંડી પર ટકે.')),
  ] },
  hinge: { id: 'hinge', metric: 'hip', cut: [135, 105, 80], levels: [
    lv('knees', l('To knees', 'घुटनों तक', 'ઘૂંટણ સુધી'), l('Weight stops at the knees.', 'वज़न घुटनों तक जाए।', 'વજન ઘૂંટણ સુધી જાય.')),
    lv('midshin', l('Mid-shin', 'पिंडली के बीच', 'પિંડીની વચ્ચે'), l('Weight reaches mid-shin, flat back.', 'वज़न पिंडली के बीच तक, पीठ सीधी।', 'વજન પિંડીની વચ્ચે સુધી, પીઠ સીધી.')),
    lv('full', l('Full stretch', 'फुल स्ट्रेच', 'ફુલ સ્ટ્રેચ'), l('Deepest hamstring stretch with a neutral spine.', 'सीधी रीढ़ के साथ हैमस्ट्रिंग का पूरा खिंचाव।', 'સીધી કરોડ સાથે હેમસ્ટ્રિંગનું પૂરું ખેંચાણ.')),
  ] },
  deadlift: { id: 'deadlift', metric: 'hip', cut: [130, 95, 75], levels: [
    lv('rack', l('Rack pull', 'रैक पुल', 'રેક પુલ'), l('From blocks just below the knees.', 'घुटनों के नीचे ब्लॉक्स से।', 'ઘૂંટણ નીચે બ્લોક્સથી.')),
    lv('floor', l('From floor', 'फ़र्श से', 'જમીનથી'), l('Standard pull from the floor.', 'फ़र्श से सामान्य पुल।', 'જમીનથી સામાન્ય પુલ.')),
    lv('deficit', l('Deficit', 'डेफ़िसिट', 'ડેફિસિટ'), l('Standing on a 2–5 cm plate for extra range.', '2–5 cm प्लेट पर खड़े होकर ज़्यादा रेंज।', '2–5 cm પ્લેટ પર ઊભા રહી વધુ રેન્જ.')),
  ] },
  thrust: { id: 'thrust', levels: [
    lv('partial', l('Partial', 'आंशिक', 'આંશિક'), l('Hips rise but stop short of straight.', 'हिप्स उठें पर सीधे होने से पहले रुकें।', 'હિપ્સ ઊંચા થાય પણ સીધા થતા પહેલા અટકે.')),
    lv('lockout', l('Full lockout', 'फुल लॉकआउट', 'ફુલ લોકઆઉટ'), l('Knees, hips and shoulders in one line at the top.', 'ऊपर घुटने, हिप्स, कंधे एक लाइन में।', 'ઉપર ઘૂંટણ, હિપ્સ, ખભા એક લાઇનમાં.')),
    lv('pause', l('Lockout + pause', 'लॉकआउट + रुकें', 'લોકઆઉટ + થોભો'), l('Hold the top 2 s with glutes squeezed.', 'ऊपर 2 सेकंड ग्लूट्स दबाकर रुकें।', 'ઉપર 2 સેકન્ડ ગ્લૂટ્સ દબાવી થોભો.')),
  ] },
  nordic: { id: 'nordic', levels: [
    lv('quarter', l('Quarter', 'क्वार्टर', 'ક્વાર્ટર'), l('Lean forward about 30° under control.', 'कंट्रोल से लगभग 30° आगे झुकें।', 'કંટ્રોલથી આશરે 30° આગળ ઝૂકો.')),
    lv('half', l('Half', 'हाफ़', 'હાફ'), l('Lower to about 45° before catching.', 'पकड़ने से पहले लगभग 45° तक नीचे।', 'પકડતા પહેલા આશરે 45° સુધી નીચે.')),
    lv('full', l('Full', 'फुल', 'ફુલ'), l('Chest all the way to the floor.', 'छाती पूरी ज़मीन तक।', 'છાતી છેક જમીન સુધી.')),
  ] },
  pushup: { id: 'pushup', metric: 'elbowMin', cut: [125, 95, 70], levels: [
    lv('partial', l('Partial', 'आंशिक', 'આંશિક'), l('Elbows bend less than 90°.', 'कोहनी 90° से कम मुड़े।', 'કોણી 90°થી ઓછી વળે.')),
    lv('full', l('Full', 'फुल', 'ફુલ'), l('Chest a fist from the floor, elbows ≈ 90°.', 'छाती ज़मीन से एक मुट्ठी, कोहनी ≈ 90°।', 'છાતી જમીનથી એક મુઠ્ઠી, કોણી ≈ 90°.')),
    lv('deficit', l('Deficit', 'डेफ़िसिट', 'ડેફિસિટ'), l('Hands on blocks, chest sinks below the hands.', 'हाथ ब्लॉक पर, छाती हाथों से नीचे।', 'હાથ બ્લોક પર, છાતી હાથથી નીચે.')),
  ] },
  press: { id: 'press', metric: 'elbowMin', cut: [120, 90, 70], levels: [
    lv('board', l('Partial / board', 'आंशिक / बोर्ड', 'આંશિક / બોર્ડ'), l('Bar stops a few cm above the chest.', 'बार छाती से कुछ cm ऊपर रुके।', 'બાર છાતીથી થોડા cm ઉપર અટકે.')),
    lv('touch', l('Touch chest', 'छाती छुएं', 'છાતીને અડો'), l('Bar touches the lower chest every rep.', 'हर रेप में बार नीचे छाती छुए।', 'દરેક રેપમાં બાર નીચલી છાતીને અડે.')),
    lv('pause', l('Paused', 'रुककर', 'થોભીને'), l('1 s still pause on the chest.', 'छाती पर 1 सेकंड रुकें।', 'છાતી પર 1 સેકન્ડ થોભો.')),
  ] },
  ohp: { id: 'ohp', metric: 'elbowMin', cut: [110, 80, 60], levels: [
    lv('forehead', l('From forehead', 'माथे से', 'કપાળથી'), l('Bar starts at forehead height.', 'बार माथे की ऊंचाई से शुरू।', 'બાર કપાળની ઊંચાઈથી શરૂ.')),
    lv('chin', l('Chin to lockout', 'ठोड़ी से लॉकआउट', 'હડપચીથી લોકઆઉટ'), l('From chin height to straight arms.', 'ठोड़ी से सीधे हाथ तक।', 'હડપચીથી સીધા હાથ સુધી.')),
    lv('full', l('Collarbone + shrug', 'कॉलरबोन + श्रग', 'કોલરબોન + શ્રગ'), l('From the collarbone to lockout, shrug at the top.', 'कॉलरबोन से लॉकआउट, ऊपर श्रग।', 'કોલરબોનથી લોકઆઉટ, ઉપર શ્રગ.')),
  ] },
  hspu: { id: 'hspu', metric: 'elbowMin', cut: [120, 90, 70], levels: [
    lv('partial', l('Partial', 'आंशिक', 'આંશિક'), l('Head stops above the floor.', 'सिर ज़मीन से ऊपर रुके।', 'માથું જમીનથી ઉપર અટકે.')),
    lv('head', l('Head to floor', 'सिर ज़मीन तक', 'માથું જમીન સુધી'), l('Top of the head touches the floor/pad.', 'सिर का ऊपरी हिस्सा ज़मीन/पैड छुए।', 'માથાનો ઉપરનો ભાગ જમીન/પેડને અડે.')),
    lv('deficit', l('Deficit', 'डेफ़िसिट', 'ડેફિસિટ'), l('Hands on parallettes, head below the hands.', 'हाथ पैरालेट्स पर, सिर हाथों से नीचे।', 'હાથ પેરાલેટ્સ પર, માથું હાથથી નીચે.')),
  ] },
  dip: { id: 'dip', metric: 'elbowMin', cut: [120, 92, 75], levels: [
    lv('partial', l('Partial', 'आंशिक', 'આંશિક'), l('Elbows bend less than 90°.', 'कोहनी 90° से कम मुड़े।', 'કોણી 90°થી ઓછી વળે.')),
    lv('ninety', l('90°', '90°', '90°'), l('Upper arm parallel to the floor.', 'ऊपरी बांह ज़मीन के बराबर।', 'ઉપલો હાથ જમીનને સમાંતર.')),
    lv('deep', l('Deep', 'डीप', 'ડીપ'), l('Shoulders sink below the elbows (only if pain-free).', 'कंधे कोहनी से नीचे (सिर्फ़ बिना दर्द)।', 'ખભા કોણીથી નીચે (ફક્ત દુખાવા વગર).')),
  ] },
  pullup: { id: 'pullup', metric: 'elbowMin', cut: [110, 75, 50], levels: [
    lv('half', l('Half', 'हाफ़', 'હાફ'), l('Pull until elbows reach 90°.', 'कोहनी 90° तक खींचें।', 'કોણી 90° સુધી ખેંચો.')),
    lv('full', l('Full (chin over)', 'फुल (ठोड़ी ऊपर)', 'ફુલ (હડપચી ઉપર)'), l('Dead hang to chin over the bar.', 'पूरे लटकने से ठोड़ी बार के ऊपर।', 'પૂરા લટકવાથી હડપચી બારની ઉપર.')),
    lv('chest', l('Chest to bar', 'छाती बार तक', 'છાતી બાર સુધી'), l('Upper chest touches the bar.', 'ऊपरी छाती बार छुए।', 'ઉપલી છાતી બારને અડે.')),
  ] },
  scap: { id: 'scap', levels: [
    lv('small', l('Small', 'छोटा', 'નાનું'), l('A small shoulder lift from a dead hang.', 'लटकने से थोड़ा कंधा उठाना।', 'લટકવાથી થોડો ખભો ઉંચકવો.')),
    lv('full', l('Full scap', 'फुल स्कैप', 'ફુલ સ્કેપ'), l('Shoulders fully down and back, arms straight.', 'कंधे पूरे नीचे और पीछे, हाथ सीधे।', 'ખભા પૂરા નીચે અને પાછળ, હાથ સીધા.')),
  ] },
  muscleup: { id: 'muscleup', levels: [
    lv('kip', l('Kipping', 'किपिंग', 'કિપિંગ'), l('Swing helps you over the bar.', 'स्विंग से बार के ऊपर।', 'સ્વિંગથી બારની ઉપર.')),
    lv('strict', l('Strict', 'स्ट्रिक्ट', 'સ્ટ્રિક્ટ'), l('No swing, chest to bar then press out.', 'बिना स्विंग, छाती बार तक फिर पुश।', 'સ્વિંગ વગર, છાતી બાર સુધી પછી પુશ.')),
    lv('slow', l('Slow / false grip', 'स्लो / फ़ॉल्स ग्रिप', 'સ્લો / ફોલ્સ ગ્રિપ'), l('Slow transition with a false grip, full dip lockout.', 'फ़ॉल्स ग्रिप से धीमा ट्रांज़िशन, पूरा लॉकआउट।', 'ફોલ્સ ગ્રિપથી ધીમું ટ્રાન્ઝિશન, પૂરું લોકઆઉટ.')),
  ] },
  row: { id: 'row', metric: 'elbowMin', cut: [120, 90, 70], levels: [
    lv('partial', l('Partial', 'आंशिक', 'આંશિક'), l('Elbows stop before the torso.', 'कोहनी धड़ से पहले रुके।', 'કોણી ધડ પહેલા અટકે.')),
    lv('full', l('Full', 'फुल', 'ફુલ'), l('Straight arms to handle at the ribs.', 'सीधे हाथ से हैंडल पसलियों तक।', 'સીધા હાથથી હેન્ડલ પાંસળી સુધી.')),
    lv('squeeze', l('Full + squeeze', 'फुल + स्क्वीज़', 'ફુલ + સ્ક્વીઝ'), l('Full range and 1 s squeeze of the shoulder blades.', 'पूरी रेंज और 1 सेकंड कंधे की हड्डियां दबाएं।', 'પૂરી રેન્જ અને 1 સેકન્ડ ખભાના હાડકાં દબાવો.')),
  ] },
  curl: { id: 'curl', metric: 'elbowMin', cut: [100, 65, 45], levels: [
    lv('top', l('Top half', 'ऊपरी आधा', 'ઉપલો અડધો'), l('From 90° up to the top only.', 'सिर्फ़ 90° से ऊपर तक।', 'ફક્ત 90°થી ઉપર સુધી.')),
    lv('full', l('Full', 'फुल', 'ફુલ'), l('Straight arm to full squeeze.', 'सीधे हाथ से पूरा स्क्वीज़।', 'સીધા હાથથી પૂરો સ્ક્વીઝ.')),
    lv('stretch', l('Full + stretch', 'फुल + स्ट्रेच', 'ફુલ + સ્ટ્રેચ'), l('Full range with a 1 s pause in the stretch.', 'पूरी रेंज, नीचे स्ट्रेच में 1 सेकंड रुकें।', 'પૂરી રેન્જ, નીચે સ્ટ્રેચમાં 1 સેકન્ડ થોભો.')),
  ] },
  triceps: { id: 'triceps', metric: 'elbowMin', cut: [110, 80, 55], levels: [
    lv('partial', l('Partial', 'आंशिक', 'આંશિક'), l('Elbows bend only part way.', 'कोहनी थोड़ी ही मुड़े।', 'કોણી થોડી જ વળે.')),
    lv('full', l('Full', 'फुल', 'ફુલ'), l('Full bend to full lockout.', 'पूरा मोड़ से पूरा लॉकआउट।', 'પૂરા વળાંકથી પૂરા લોકઆઉટ.')),
    lv('stretch', l('Deep stretch', 'डीप स्ट्रेच', 'ડીપ સ્ટ્રેચ'), l('Elbows travel back for a long triceps stretch.', 'कोहनी पीछे, ट्राइसेप्स का लंबा खिंचाव।', 'કોણી પાછળ, ટ્રાઇસેપ્સનું લાંબું ખેંચાણ.')),
  ] },
  raise: { id: 'raise', metric: 'shoulder', higherIsDeeper: true, cut: [50, 80, 110], levels: [
    lv('partial', l('Partial (45°)', 'आंशिक (45°)', 'આંશિક (45°)'), l('Arms rise about halfway.', 'हाथ लगभग आधे उठें।', 'હાથ આશરે અડધા ઊંચા થાય.')),
    lv('parallel', l('Parallel (90°)', 'पैरेलल (90°)', 'પેરેલલ (90°)'), l('Arms level with the shoulders.', 'हाथ कंधों के बराबर।', 'હાથ ખભાની બરાબર.')),
    lv('above', l('Above (Y)', 'ऊपर (Y)', 'ઉપર (Y)'), l('Arms go above the shoulders.', 'हाथ कंधों से ऊपर।', 'હાથ ખભાથી ઉપર.')),
  ] },
  facepull: { id: 'facepull', levels: [
    lv('partial', l('To chin', 'ठोड़ी तक', 'હડપચી સુધી'), l('Rope stops in front of the chin.', 'रस्सी ठोड़ी के सामने रुके।', 'દોરડું હડપચી સામે અટકે.')),
    lv('full', l('To face', 'चेहरे तक', 'ચહેરા સુધી'), l('Rope to the forehead, elbows high.', 'रस्सी माथे तक, कोहनी ऊपर।', 'દોરડું કપાળ સુધી, કોણી ઉપર.')),
    lv('rotate', l('Face + rotate', 'चेहरा + घुमाएं', 'ચહેરો + ફેરવો'), l('Rope apart and rotate thumbs back (double-biceps).', 'रस्सी अलग, अंगूठे पीछे घुमाएं।', 'દોરડું અલગ, અંગૂઠા પાછળ ફેરવો.')),
  ] },
  calf: { id: 'calf', levels: [
    lv('half', l('Half', 'हाफ़', 'હાફ'), l('Heels lift halfway on flat floor.', 'समतल ज़मीन पर एड़ी आधी उठे।', 'સપાટ જમીન પર એડી અડધી ઊંચકાય.')),
    lv('full', l('Full', 'फुल', 'ફુલ'), l('Highest tiptoe on flat floor.', 'समतल ज़मीन पर पूरे पंजों पर।', 'સપાટ જમીન પર પૂરા પંજા પર.')),
    lv('deficit', l('Deficit (step)', 'डेफ़िसिट (स्टेप)', 'ડેફિસિટ (સ્ટેપ)'), l('On a step: heels drop below, then full rise.', 'स्टेप पर: एड़ी नीचे, फिर पूरा ऊपर।', 'સ્ટેપ પર: એડી નીચે, પછી પૂરું ઉપર.')),
  ] },
  plank: { id: 'plank', levels: [
    lv('knees', l('On knees', 'घुटनों पर', 'ઘૂંટણ પર'), l('Knees down, straight line from knees to head.', 'घुटने नीचे, घुटनों से सिर तक सीधी लाइन।', 'ઘૂંટણ નીચે, ઘૂંટણથી માથા સુધી સીધી લાઇન.')),
    lv('full', l('Full', 'फुल', 'ફુલ'), l('On toes, body in one straight line.', 'पंजों पर, शरीर एक सीधी लाइन में।', 'પંજા પર, શરીર એક સીધી લાઇનમાં.')),
    lv('rkc', l('Hard (RKC)', 'हार्ड (RKC)', 'હાર્ડ (RKC)'), l('Squeeze glutes, pull elbows to toes, max tension.', 'ग्लूट्स दबाएं, कोहनी पंजों की ओर खींचें।', 'ગ્લૂટ્સ દબાવો, કોણી પંજા તરફ ખેંચો.')),
  ] },
  hollow: { id: 'hollow', levels: [
    lv('tuck', l('Tuck', 'टक', 'ટક'), l('Knees bent, arms by the sides.', 'घुटने मुड़े, हाथ बगल में।', 'ઘૂંટણ વળેલા, હાથ બાજુમાં.')),
    lv('legs', l('Straight legs', 'सीधे पैर', 'સીધા પગ'), l('Legs straight and low, arms forward.', 'पैर सीधे और नीचे, हाथ आगे।', 'પગ સીધા અને નીચા, હાથ આગળ.')),
    lv('full', l('Full hollow', 'फुल हॉलो', 'ફુલ હોલો'), l('Arms overhead, legs a few cm off the floor.', 'हाथ सिर के ऊपर, पैर ज़मीन से कुछ cm ऊपर।', 'હાથ માથા ઉપર, પગ જમીનથી થોડા cm ઉપર.')),
  ] },
  legraise: { id: 'legraise', metric: 'hip', cut: [130, 95, 60], levels: [
    lv('knees', l('Knees to 90°', 'घुटने 90° तक', 'ઘૂંટણ 90° સુધી'), l('Bent knees rise to hip height.', 'मुड़े घुटने हिप की ऊंचाई तक।', 'વળેલા ઘૂંટણ હિપની ઊંચાઈ સુધી.')),
    lv('legs90', l('Legs to 90°', 'पैर 90° तक', 'પગ 90° સુધી'), l('Straight legs reach parallel to the floor.', 'सीधे पैर ज़मीन के बराबर।', 'સીધા પગ જમીનને સમાંતર.')),
    lv('toes', l('Toes to bar', 'पंजे बार तक', 'પંજા બાર સુધી'), l('Straight legs all the way to the bar.', 'सीधे पैर पूरे बार तक।', 'સીધા પગ છેક બાર સુધી.')),
  ] },
  dragon: { id: 'dragon', levels: [
    lv('tuck', l('Tuck', 'टक', 'ટક'), l('Knees bent, hips straight.', 'घुटने मुड़े, हिप्स सीधे।', 'ઘૂંટણ વળેલા, હિપ્સ સીધા.')),
    lv('half', l('Half range', 'आधी रेंज', 'અડધી રેન્જ'), l('Straight body lowers halfway.', 'सीधा शरीर आधा नीचे।', 'સીધું શરીર અડધું નીચે.')),
    lv('full', l('Full range', 'पूरी रेंज', 'પૂરી રેન્જ'), l('Straight body to just above the bench.', 'सीधा शरीर बेंच के ठीक ऊपर तक।', 'સીધું શરીર બેન્ચની બરાબર ઉપર સુધી.')),
  ] },
  lever: { id: 'lever', levels: [
    lv('above', l('Above parallel', 'पैरेलल से ऊपर', 'પેરેલલથી ઉપર'), l('Hips higher than the shoulders.', 'हिप्स कंधों से ऊपर।', 'હિપ્સ ખભાથી ઉપર.')),
    lv('parallel', l('Parallel', 'पैरेलल', 'પેરેલલ'), l('Body level with the floor.', 'शरीर ज़मीन के बराबर।', 'શરીર જમીનને સમાંતર.')),
    lv('strict', l('Strict line', 'स्ट्रिक्ट लाइन', 'સ્ટ્રિક્ટ લાઇન'), l('Parallel, straight arms, hips fully open.', 'पैरेलल, सीधे हाथ, हिप्स पूरे खुले।', 'પેરેલલ, સીધા હાથ, હિપ્સ પૂરા ખુલ્લા.')),
  ] },
  flag: { id: 'flag', levels: [
    lv('above', l('Diagonal', 'तिरछा', 'ત્રાંસું'), l('Feet higher than the hips.', 'पैर हिप्स से ऊपर।', 'પગ હિપ્સથી ઉપર.')),
    lv('parallel', l('Parallel', 'पैरेलल', 'પેરેલલ'), l('Body level with the floor.', 'शरीर ज़मीन के बराबर।', 'શરીર જમીનને સમાંતર.')),
    lv('strict', l('Strict line', 'स्ट्रिक्ट लाइन', 'સ્ટ્રિક્ટ લાઇન'), l('Parallel with arms locked and legs together.', 'पैरेलल, हाथ लॉक, पैर साथ।', 'પેરેલલ, હાથ લોક, પગ સાથે.')),
  ] },
  lsit: { id: 'lsit', levels: [
    lv('tuck', l('Tuck', 'टक', 'ટક'), l('Knees to chest, feet off the floor.', 'घुटने छाती की ओर, पैर ज़मीन से ऊपर।', 'ઘૂંટણ છાતી તરફ, પગ જમીનથી ઉપર.')),
    lv('full', l('Full L', 'फुल L', 'ફુલ L'), l('Straight legs level with the hips.', 'सीधे पैर हिप्स के बराबर।', 'સીધા પગ હિપ્સની બરાબર.')),
    lv('v', l('V-sit', 'V-सिट', 'V-સિટ'), l('Legs rise above hip level.', 'पैर हिप्स से ऊपर।', 'પગ હિપ્સથી ઉપર.')),
  ] },
  handstand: { id: 'handstand', levels: [
    lv('banana', l('Arched', 'आर्च्ड', 'આર્ચ્ડ'), l('Holding, with a curved back.', 'मुड़ी पीठ के साथ होल्ड।', 'વળેલી પીઠ સાથે હોલ્ડ.')),
    lv('line', l('Straight line', 'सीधी लाइन', 'સીધી લાઇન'), l('Wrists, shoulders, hips, feet stacked.', 'कलाई, कंधे, हिप्स, पैर एक लाइन में।', 'કાંડા, ખભા, હિપ્સ, પગ એક લાઇનમાં.')),
    lv('open', l('Open shoulders', 'खुले कंधे', 'ખુલ્લા ખભા'), l('Straight line and shoulders fully pushed to the ears.', 'सीधी लाइन, कंधे पूरे कानों तक पुश।', 'સીધી લાઇન, ખભા પૂરા કાન સુધી પુશ.')),
  ] },
  hang: { id: 'hang', levels: [
    lv('feet', l('Feet assisted', 'पैरों की मदद', 'પગની મદદ'), l('Toes on the floor take some weight.', 'पंजे ज़मीन पर थोड़ा वज़न लें।', 'પંજા જમીન પર થોડું વજન લે.')),
    lv('passive', l('Full hang', 'फुल हैंग', 'ફુલ હેંગ'), l('All bodyweight, shoulders relaxed.', 'पूरा वज़न, कंधे ढीले।', 'પૂરું વજન, ખભા ઢીલા.')),
    lv('active', l('Active hang', 'एक्टिव हैंग', 'એક્ટિવ હેંગ'), l('All bodyweight, shoulders pulled down.', 'पूरा वज़न, कंधे नीचे खींचे।', 'પૂરું વજન, ખભા નીચે ખેંચેલા.')),
  ] },
  inverted: { id: 'inverted', levels: [
    lv('tuck', l('Tuck', 'टक', 'ટક'), l('Knees tucked to the chest.', 'घुटने छाती से लगे।', 'ઘૂંટણ છાતીને અડેલા.')),
    lv('straddle', l('Straddle', 'स्ट्रैडल', 'સ્ટ્રેડલ'), l('Legs wide apart.', 'पैर चौड़े।', 'પગ પહોળા.')),
    lv('full', l('Full', 'फुल', 'ફુલ'), l('Body straight and vertical.', 'शरीर सीधा और खड़ा।', 'શરીર સીધું અને ઊભું.')),
  ] },
  headstand: { id: 'headstand', levels: [
    lv('tripod', l('Tripod tuck', 'ट्राइपॉड टक', 'ટ્રાઇપોડ ટક'), l('Knees resting on the elbows.', 'घुटने कोहनी पर टिके।', 'ઘૂંટણ કોણી પર ટકેલા.')),
    lv('bent', l('Legs up, bent', 'पैर ऊपर, मुड़े', 'પગ ઉપર, વળેલા'), l('Knees bent, thighs up.', 'घुटने मुड़े, जांघें ऊपर।', 'ઘૂંટણ વળેલા, જાંઘ ઉપર.')),
    lv('full', l('Full straight', 'फुल सीधा', 'ફુલ સીધું'), l('Legs straight and together.', 'पैर सीधे और साथ।', 'પગ સીધા અને સાથે.')),
  ] },
  split: { id: 'split', levels: [
    lv('high', l('Blocks / high', 'ब्लॉक्स / ऊंचा', 'બ્લોક્સ / ઊંચું'), l('Hips well above the floor, hands on blocks.', 'हिप्स ज़मीन से काफ़ी ऊपर, हाथ ब्लॉक पर।', 'હિપ્સ જમીનથી ઘણા ઉપર, હાથ બ્લોક પર.')),
    lv('half', l('Halfway', 'आधा', 'અડધું'), l('Hips about a hand-width from the floor.', 'हिप्स ज़मीन से लगभग एक हाथ।', 'હિપ્સ જમીનથી આશરે એક હાથ.')),
    lv('full', l('Full split', 'फुल स्प्लिट', 'ફુલ સ્પ્લિટ'), l('Hips on the floor, square.', 'हिप्स ज़मीन पर, सीधे।', 'હિપ્સ જમીન પર, સીધા.')),
  ] },
  squathold: { id: 'squathold', metric: 'kneeMin', cut: [110, 80, 60], levels: [
    lv('heels', l('Heels raised', 'एड़ी उठी', 'એડી ઉંચકેલી'), l('Heels on a plate or book.', 'एड़ी प्लेट या किताब पर।', 'એડી પ્લેટ કે પુસ્તક પર.')),
    lv('flat', l('Heels down', 'एड़ी नीचे', 'એડી નીચે'), l('Flat feet, hips below knees.', 'पैर सपाट, हिप्स घुटनों से नीचे।', 'પગ સપાટ, હિપ્સ ઘૂંટણથી નીચે.')),
    lv('atg', l('ATG + tall chest', 'ATG + सीधी छाती', 'ATG + સીધી છાતી'), l('Deepest squat with an upright torso.', 'सीधे धड़ के साथ सबसे गहरा स्क्वाट।', 'સીધા ધડ સાથે સૌથી ઊંડો સ્ક્વોટ.')),
  ] },
  stretch: { id: 'stretch', levels: [
    lv('easy', l('Easy', 'आसान', 'સરળ'), l('Gentle stretch, easy breathing.', 'हल्का खिंचाव, आराम से सांस।', 'હળવું ખેંચાણ, આરામથી શ્વાસ.')),
    lv('medium', l('Medium', 'मीडियम', 'મીડિયમ'), l('Clear stretch, still relaxed.', 'साफ़ खिंचाव, फिर भी आराम।', 'સ્પષ્ટ ખેંચાણ, છતાં આરામ.')),
    lv('end', l('End range', 'एंड रेंज', 'એન્ડ રેન્જ'), l('Your deepest pain-free position.', 'बिना दर्द की सबसे गहरी पोज़िशन।', 'દુખાવા વગરની સૌથી ઊંડી પોઝિશન.')),
  ] },
  spine: { id: 'spine', levels: [
    lv('small', l('Small', 'छोटा', 'નાનું'), l('Small comfortable movement.', 'छोटी आरामदायक हरकत।', 'નાની આરામદાયક હલનચલન.')),
    lv('full', l('Full wave', 'फुल वेव', 'ફુલ વેવ'), l('Full spinal curl and arch, slow.', 'रीढ़ का पूरा मोड़ और आर्च, धीरे।', 'કરોડનો પૂરો વળાંક અને આર્ચ, ધીમે.')),
  ] },
  burpee: { id: 'burpee', levels: [
    lv('step', l('Step-back', 'स्टेप-बैक', 'સ્ટેપ-બેક'), l('Step feet back, no push-up, no jump.', 'पैर पीछे स्टेप, बिना पुश-अप, बिना जंप।', 'પગ પાછળ સ્ટેપ, પુશ-અપ વગર, જંપ વગર.')),
    lv('full', l('Full', 'फुल', 'ફુલ'), l('Chest to floor, then jump with hands overhead.', 'छाती ज़मीन तक, फिर हाथ ऊपर करके जंप।', 'છાતી જમીન સુધી, પછી હાથ ઉપર કરી જંપ.')),
    lv('tuck', l('Full + tuck jump', 'फुल + टक जंप', 'ફુલ + ટક જંપ'), l('Full burpee with knees to chest in the jump.', 'जंप में घुटने छाती तक।', 'જંપમાં ઘૂંટણ છાતી સુધી.')),
  ] },
  rope: { id: 'rope', levels: [
    lv('basic', l('Basic bounce', 'बेसिक बाउंस', 'બેસિક બાઉન્સ'), l('Small two-feet hops.', 'दोनों पैरों से छोटी कूद।', 'બંને પગે નાની કૂદ.')),
    lv('alt', l('Alternate feet', 'बारी-बारी पैर', 'વારાફરતી પગ'), l('Running step over the rope.', 'रस्सी पर दौड़ते कदम।', 'દોરડા પર દોડતા પગલાં.')),
    lv('du', l('Double-unders', 'डबल-अंडर', 'ડબલ-અંડર'), l('Rope passes twice per jump.', 'एक जंप में रस्सी दो बार।', 'એક જંપમાં દોરડું બે વાર.')),
  ] },
  jacks: { id: 'jacks', levels: [
    lv('half', l('Half jacks', 'हाफ़ जैक्स', 'હાફ જેક્સ'), l('Hands to shoulder height.', 'हाथ कंधे की ऊंचाई तक।', 'હાથ ખભાની ઊંચાઈ સુધી.')),
    lv('full', l('Full jacks', 'फुल जैक्स', 'ફુલ જેક્સ'), l('Hands meet overhead, feet wide.', 'हाथ सिर के ऊपर मिलें, पैर चौड़े।', 'હાથ માથા ઉપર મળે, પગ પહોળા.')),
    lv('star', l('Star jumps', 'स्टार जंप', 'સ્ટાર જંપ'), l('Explosive jump into a full star.', 'तेज़ जंप से पूरा स्टार।', 'ઝડપી જંપથી પૂરો સ્ટાર.')),
  ] },
  traverse: { id: 'traverse', levels: [
    lv('each', l('Every rung', 'हर रंग', 'દરેક રંગ'), l('Both hands on each rung.', 'हर रंग पर दोनों हाथ।', 'દરેક રંગ પર બંને હાથ.')),
    lv('alt', l('Hand over hand', 'हाथ के ऊपर हाथ', 'હાથ ઉપર હાથ'), l('One hand per rung.', 'एक रंग पर एक हाथ।', 'એક રંગ પર એક હાથ.')),
    lv('skip', l('Skip a rung', 'एक रंग छोड़ें', 'એક રંગ છોડો'), l('Reach past one rung each move.', 'हर बार एक रंग छोड़कर पकड़ें।', 'દરેક વખતે એક રંગ છોડી પકડો.')),
  ] },
  generic: { id: 'generic', levels: [
    lv('partial', l('Partial', 'आंशिक', 'આંશિક'), l('Shorter range while you learn.', 'सीखते समय कम रेंज।', 'શીખતી વખતે ઓછી રેન્જ.')),
    lv('full', l('Full', 'फुल', 'ફુલ'), l('Complete range of motion.', 'पूरी रेंज।', 'પૂરી રેન્જ.')),
    lv('pause', l('Full + pause', 'फुल + रुकें', 'ફુલ + થોભો'), l('Full range with a pause at the hardest point.', 'पूरी रेंज, सबसे कठिन जगह रुकें।', 'પૂરી રેન્જ, સૌથી અઘરી જગ્યાએ થોભો.')),
  ] },
}

/** exercise id → ROM family (every library exercise is listed; custom ones fall back by category) */
export const EX_ROM: Record<string, string> = {
  'bodyweight-squat': 'squat', 'goblet-squat': 'squat', 'back-squat': 'squat', 'front-squat': 'squat',
  'forward-lunge': 'lunge', 'bulgarian-split-squat': 'lunge', 'pistol-squat': 'pistol',
  'romanian-deadlift': 'hinge', 'single-leg-rdl': 'hinge', 'b-stance-rdl': 'hinge', 'single-leg-rdl-loaded': 'hinge',
  deadlift: 'deadlift', 'hip-thrust': 'thrust',
  'nordic-curl': 'nordic', 'band-nordic': 'nordic', 'nordic-negative': 'nordic',
  'push-up': 'pushup', 'bench-press': 'press', 'dumbbell-bench-press': 'press', 'overhead-press': 'ohp',
  'pike-push-up': 'hspu', 'handstand-push-up': 'hspu', dips: 'dip',
  'pull-up': 'pullup', 'chin-up': 'pullup', 'negative-pull-up': 'pullup', 'band-pull-up': 'pullup', 'weighted-pull-up': 'pullup', 'archer-pull-up': 'pullup', 'lat-pulldown': 'pullup',
  'scap-pull-up': 'scap', 'muscle-up': 'muscleup',
  'inverted-row': 'row', 'dumbbell-row': 'row', 'barbell-row': 'row', 'seated-cable-row': 'row', 'face-pull': 'facepull',
  'preacher-curl': 'curl', 'barbell-curl': 'curl', 'hammer-curl': 'curl',
  'skull-crusher': 'triceps', 'triceps-pushdown': 'triceps', 'lateral-raise': 'raise',
  'calf-raise': 'calf',
  plank: 'plank', 'side-plank': 'plank', 'hollow-hold': 'hollow',
  'hanging-leg-raise': 'legraise', 'hanging-knee-raise': 'legraise', 'toes-to-bar': 'legraise',
  'dragon-flag': 'dragon', 'tuck-dragon-flag': 'dragon', 'dragon-flag-negative': 'dragon',
  'tuck-front-lever': 'lever', 'back-lever': 'lever', 'adv-tuck-front-lever': 'lever', 'one-leg-front-lever': 'lever', 'straddle-front-lever': 'lever', 'full-front-lever': 'lever', 'front-lever-raise': 'lever',
  'human-flag-progression': 'flag', 'vertical-flag': 'flag', 'straddle-human-flag': 'flag', 'full-human-flag': 'flag',
  'l-sit': 'lsit',
  'wall-handstand': 'handstand', 'chest-to-wall-handstand': 'handstand', 'freestanding-handstand': 'handstand',
  'dead-hang': 'hang', 'inverted-hang': 'inverted', headstand: 'headstand', 'monkey-bar-traverse': 'traverse',
  'deep-squat-hold': 'squathold', 'worlds-greatest-stretch': 'stretch', 'couch-stretch': 'stretch', 'front-split': 'split', 'middle-split': 'split',
  'cat-cow': 'spine', burpee: 'burpee', 'jump-rope': 'rope', 'jumping-jack': 'jacks',
  unknown: 'generic',
}

export function romFamily(ex: Pick<Exercise, 'id' | 'category'> | string): RomFamily {
  const id = typeof ex === 'string' ? ex : ex.id
  const fam = EX_ROM[id]
  if (fam) return ROM_FAMILIES[fam]
  const cat = typeof ex === 'string' ? allExercises().find((e) => e.id === ex)?.category : ex.category
  return ROM_FAMILIES[cat === 'mobility' ? 'stretch' : 'generic']
}
export const romLevels = (ex: Pick<Exercise, 'id' | 'category'> | string) => romFamily(ex).levels
export const romText = (x: L3, lang: Lang) => x[lang] || x.en

/** The level reached for a measured joint angle (null = not even the first level). */
export function romFromAngle(fam: RomFamily, deg: number): number | null {
  if (!fam.cut) return null
  let got: number | null = null
  fam.cut.forEach((c, i) => { if (fam.higherIsDeeper ? deg >= c : deg <= c) got = i })
  return got
}

/** Pick the angle this family is measured by from Analyze's pose metrics. */
export function romAngleFromMetrics(fam: RomFamily, metrics: Record<string, { v: number } | undefined>): number | null {
  if (!fam.metric) return null
  const m = fam.metric === 'kneeMin' ? metrics.kneeMin : fam.metric === 'elbowMin' ? metrics.elbowMin : fam.metric === 'hip' ? metrics.hip : metrics.shoulder
  return m && Number.isFinite(m.v) ? m.v : null
}
