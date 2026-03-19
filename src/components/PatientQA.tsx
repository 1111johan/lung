import { useRef, useState } from 'react';
import {
  Send,
  ShieldAlert,
  MessageCircle,
  Sparkles,
  Pause,
  FileText,
  Image as ImageIcon,
  Mic,
  Video,
  X,
  MapPin,
} from 'lucide-react';
import { uiStyles } from '../lib/theme';
import { askDeepseek } from '../lib/deepseek';
import { DigitalHumanAvatar } from './DigitalHuman';
import { speakText, stopSpeaking } from '../lib/voice';
import { useI18n, type AppLocale } from '../lib/i18n';
import { fetchNearbyHospitals, getAmapConfigStatus, type GeoPoint, type NearbyHospital } from '../lib/amap';
import { getCurrentPositionWithBrowserFallback } from '../lib/location';
import { saveNearbyHospitalsPayload, type NearbyHospitalsMapPayload } from '../lib/nearbyHospitalsState';

interface ChatItem {
  sender: 'user' | 'bot';
  text: string;
  attachments?: Attachment[];
  followUps?: string[];
  showHospitalMapButton?: boolean;
}

interface PatientQAProps {
  onOpenHospitalMap?: (payload: NearbyHospitalsMapPayload) => void;
}

type AttachmentKind = 'doc' | 'video' | 'audio' | 'image';

interface Attachment {
  id: string;
  name: string;
  size: string;
  kind: AttachmentKind;
}

const quickQuestions = [
  '咳嗽≥2周、夜间盗汗、体重下降是结核的典型组合吗？',
  'IGRA/PPD 阳性但胸片正常，需要做什么复查？',
  '痰涂片阴性还能是肺结核吗，下一步怎么查？',
  '家庭成员确诊肺结核后，密接者要做哪些筛查？',
  '孕妇或哺乳期疑似结核，影像和用药注意什么？',
  '耐药结核（MDR/XDR）与普通结核有什么区别？',
  '长期低热+盗汗但咳嗽不明显，可能是结核吗？',
  '结核治疗需要服药多久，停药或漏服有什么风险？',
  '什么时候可以解除隔离，复查标准是什么？',
  '合并糖尿病或 HIV 时，结核管理有哪些特别注意？',
];

const attachmentLabel = (kind: AttachmentKind, tr: (text: string) => string) => {
  if (kind === 'doc') return tr('文档');
  if (kind === 'image') return tr('图片');
  if (kind === 'audio') return tr('语音');
  return tr('视频');
};

const hasAnyKeyword = (text: string, keywords: string[]) => keywords.some((keyword) => text.includes(keyword));

const hospitalIntentKeywords = [
  '医院',
  '定点',
  '附近',
  '就近',
  '结核病医院',
  '结核病防治所',
  '传染病医院',
  '胸科医院',
  'hospital',
  'clinic',
  'nearby hospital',
  'tb hospital',
];

const followupTemplates: Record<
  AppLocale,
  {
    general: string[];
    symptom: string[];
    test: string[];
    treatment: string[];
    prevention: string[];
    emergency: string[];
  }
> = {
  zh: {
    general: [
      '如果我现在去医院，应该优先做哪两项检查？',
      '我这种情况建议多久复查一次？',
      '有哪些情况出现时需要立即线下就医？',
    ],
    symptom: [
      '这些症状里，哪个最提示结核风险升高？',
      '症状持续多久需要立刻做影像检查？',
      '如果症状减轻了，还需要继续复查吗？',
    ],
    test: [
      'IGRA、PPD、痰检和胸片，下一步检查顺序怎么安排？',
      '检查结果互相矛盾时该怎么判断？',
      '如果首次检查阴性，还要不要做复检？',
    ],
    treatment: [
      '如果确诊结核，标准治疗周期通常多长？',
      '漏服药后该如何补救，风险大吗？',
      '治疗期间最关键的随访指标是什么？',
    ],
    prevention: [
      '家人或同住者现在该怎么做筛查？',
      '在家隔离和日常防护要点有哪些？',
      '什么时候可以考虑解除隔离？',
    ],
    emergency: [
      '出现咳血或呼吸困难时，第一步该怎么处理？',
      '哪些危险信号提示需要急诊？',
      '去急诊前需要准备哪些既往检查资料？',
    ],
  },
  en: {
    general: [
      'If I visit a clinic now, which two tests should be prioritized?',
      'How often should I recheck in my case?',
      'Which warning signs mean I should seek in-person care immediately?',
    ],
    symptom: [
      'Which of these symptoms most strongly suggests higher TB risk?',
      'How long should symptoms persist before immediate imaging is needed?',
      'If symptoms improve, do I still need follow-up tests?',
    ],
    test: [
      'How should IGRA, PPD, sputum, and chest imaging be sequenced next?',
      'How should conflicting test results be interpreted?',
      'If the first test is negative, should repeat testing still be done?',
    ],
    treatment: [
      'If TB is confirmed, what is the typical treatment duration?',
      'If a dose is missed, what is the best recovery plan and risk?',
      'What follow-up indicators matter most during treatment?',
    ],
    prevention: [
      'What screening steps should household contacts take now?',
      'What are the key home isolation and infection-control points?',
      'When can isolation usually be lifted safely?',
    ],
    emergency: [
      'If hemoptysis or breathing difficulty occurs, what should be done first?',
      'Which danger signs suggest emergency care is needed now?',
      'What prior records should I bring before going to emergency care?',
    ],
  },
  th: {
    general: [
      'ถ้าจะไปโรงพยาบาลตอนนี้ ควรตรวจ 2 รายการไหนก่อน?',
      'กรณีแบบนี้ควรติดตามซ้ำทุกกี่วัน?',
      'มีสัญญาณอะไรบ้างที่ควรไปพบแพทย์ทันที?',
    ],
    symptom: [
      'อาการใดบ่งชี้ว่าความเสี่ยงวัณโรคสูงขึ้นมากที่สุด?',
      'อาการนานแค่ไหนจึงควรตรวจภาพถ่ายทรวงอกทันที?',
      'ถ้าอาการดีขึ้นแล้ว ยังต้องติดตามตรวจต่อหรือไม่?',
    ],
    test: [
      'ควรจัดลำดับ IGRA, PPD, ตรวจเสมหะ และภาพถ่ายทรวงอกอย่างไร?',
      'ถ้าผลตรวจขัดแย้งกันควรตีความอย่างไร?',
      'ถ้าตรวจครั้งแรกเป็นลบ ยังควรตรวจซ้ำหรือไม่?',
    ],
    treatment: [
      'หากยืนยันวัณโรค ระยะเวลารักษามาตรฐานนานเท่าไร?',
      'ถ้าลืมกินยา ควรแก้ไขอย่างไรและเสี่ยงมากไหม?',
      'ระหว่างรักษา ค่าติดตามใดสำคัญที่สุด?',
    ],
    prevention: [
      'คนในครอบครัวหรือผู้สัมผัสใกล้ชิดควรคัดกรองอย่างไรตอนนี้?',
      'แนวทางแยกกักที่บ้านและป้องกันการแพร่เชื้อมีอะไรบ้าง?',
      'โดยทั่วไปเมื่อไรจึงพิจารณายุติการแยกกักได้?',
    ],
    emergency: [
      'ถ้ามีไอเป็นเลือดหรือหายใจลำบาก ควรทำอะไรเป็นอันดับแรก?',
      'สัญญาณอันตรายใดที่บ่งชี้ว่าควรไปฉุกเฉินทันที?',
      'ก่อนไปฉุกเฉินควรเตรียมผลตรวจเดิมอะไรไปด้วย?',
    ],
  },
  id: {
    general: [
      'Jika saya ke rumah sakit sekarang, dua pemeriksaan apa yang diprioritaskan?',
      'Dalam kondisi ini, seberapa sering saya perlu kontrol ulang?',
      'Tanda apa yang mengharuskan saya segera berobat langsung?',
    ],
    symptom: [
      'Gejala mana yang paling mengarah ke peningkatan risiko TB?',
      'Jika gejala berlangsung berapa lama harus segera lakukan pencitraan?',
      'Jika gejala membaik, apakah tetap perlu kontrol ulang?',
    ],
    test: [
      'Bagaimana urutan IGRA, PPD, pemeriksaan dahak, dan foto toraks?',
      'Bagaimana menilai hasil pemeriksaan yang saling bertentangan?',
      'Jika pemeriksaan pertama negatif, apakah perlu tes ulang?',
    ],
    treatment: [
      'Jika TB terkonfirmasi, berapa lama durasi terapi standar?',
      'Jika ada dosis terlewat, bagaimana cara koreksi yang tepat?',
      'Indikator kontrol apa yang paling penting selama terapi?',
    ],
    prevention: [
      'Langkah skrining apa yang perlu dilakukan keluarga serumah sekarang?',
      'Apa poin penting isolasi rumah dan pencegahan penularan?',
      'Kapan isolasi biasanya bisa dihentikan dengan aman?',
    ],
    emergency: [
      'Jika batuk darah atau sesak napas, langkah pertama apa?',
      'Tanda bahaya apa yang menandakan perlu ke IGD sekarang?',
      'Dokumen hasil pemeriksaan apa yang perlu dibawa ke IGD?',
    ],
  },
  ms: {
    general: [
      'Jika saya ke hospital sekarang, dua ujian apa patut diutamakan?',
      'Untuk keadaan ini, berapa kerap perlu semakan susulan?',
      'Tanda amaran apa yang perlukan rawatan bersemuka segera?',
    ],
    symptom: [
      'Gejala mana paling menunjukkan risiko TB meningkat?',
      'Jika gejala berlarutan, bila perlu buat imejan segera?',
      'Jika gejala berkurang, adakah masih perlu semakan semula?',
    ],
    test: [
      'Bagaimana susunan IGRA, PPD, ujian kahak dan imejan dada?',
      'Bagaimana menilai keputusan ujian yang bercanggah?',
      'Jika ujian pertama negatif, adakah masih perlu ujian semula?',
    ],
    treatment: [
      'Jika TB disahkan, berapa lama tempoh rawatan standard?',
      'Jika dos ubat terlepas, bagaimana langkah pembetulan terbaik?',
      'Penunjuk susulan apa paling penting semasa rawatan?',
    ],
    prevention: [
      'Apakah langkah saringan untuk ahli keluarga/serumah sekarang?',
      'Apakah perkara penting bagi isolasi di rumah dan pencegahan?',
      'Bilakah isolasi biasanya boleh ditamatkan dengan selamat?',
    ],
    emergency: [
      'Jika batuk berdarah atau sukar bernafas, apakah langkah pertama?',
      'Tanda bahaya apa menunjukkan perlu ke kecemasan segera?',
      'Rekod pemeriksaan apa yang perlu dibawa ke jabatan kecemasan?',
    ],
  },
};

function buildFollowupQuestions(answer: string, previousQuestion: string, locale: AppLocale) {
  const templates = followupTemplates[locale] || followupTemplates.en;
  const merged = `${answer} ${previousQuestion}`.toLowerCase();

  const pool: string[] = [];
  if (
    hasAnyKeyword(merged, ['咳', '痰', '发热', '盗汗', '胸痛', '气促', 'cough', 'sputum', 'fever', 'night sweat', 'chest pain'])
  ) {
    pool.push(...templates.symptom);
  }
  if (hasAnyKeyword(merged, ['igra', 'ppd', '痰检', '胸片', 'ct', 'x-ray', 'sputum', 'imaging', '检查', '检验'])) {
    pool.push(...templates.test);
  }
  if (hasAnyKeyword(merged, ['治疗', '用药', '服药', '耐药', 'mdr', 'xdr', 'treatment', 'medication', 'drug resistance'])) {
    pool.push(...templates.treatment);
  }
  if (hasAnyKeyword(merged, ['密接', '家人', '同住', '隔离', '接触', 'contact', 'household', 'isolation', 'prevention'])) {
    pool.push(...templates.prevention);
  }
  if (hasAnyKeyword(merged, ['咳血', '呼吸困难', '高热', '急诊', 'hemoptysis', 'dyspnea', 'emergency', 'severe'])) {
    pool.push(...templates.emergency);
  }
  pool.push(...templates.general);

  return Array.from(new Set(pool.filter((item) => item.trim() && item.trim() !== previousQuestion.trim()))).slice(0, 3);
}

function isHospitalIntent(text: string) {
  const normalized = text.toLowerCase();
  return hospitalIntentKeywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function formatDistance(distanceMeter: number, locale: AppLocale) {
  if (distanceMeter < 1000) return `${Math.max(1, Math.round(distanceMeter))}m`;
  const km = (distanceMeter / 1000).toFixed(1);
  if (locale === 'zh') return `${km}公里`;
  if (locale === 'th') return `${km}กม.`;
  return `${km}km`;
}

function buildHospitalSuccessReply(point: GeoPoint, hospitals: NearbyHospital[], locale: AppLocale) {
  const copy =
    locale === 'zh'
      ? {
          intro: '已根据你当前位置推荐附近医院（优先结核/呼吸相关）：',
          current: '当前位置',
          address: '地址',
          unknownAddress: '未知地址',
          phone: '电话',
          noPhone: '暂无',
          noHospitals: '当前范围内未查询到医院。',
          cta: '点击下方“进入定点推送页”可查看地图点位并一键导航。',
        }
      : locale === 'th'
        ? {
            intro: 'แนะนำโรงพยาบาลใกล้เคียงตามตำแหน่งปัจจุบันของคุณแล้ว (เน้นโรควัณโรค/โรคระบบหายใจ):',
            current: 'ตำแหน่งปัจจุบัน',
            address: 'ที่อยู่',
            unknownAddress: 'ไม่ทราบที่อยู่',
            phone: 'โทรศัพท์',
            noPhone: 'ไม่มีข้อมูล',
            noHospitals: 'ไม่พบโรงพยาบาลในช่วงระยะนี้',
            cta: 'กดปุ่ม “เปิดหน้าแผนที่จุดส่งต่อ” ด้านล่างเพื่อดูตำแหน่งและนำทาง',
          }
        : locale === 'id'
          ? {
              intro: 'Rumah sakit terdekat berdasarkan lokasi Anda telah direkomendasikan (prioritas TB/pernapasan):',
              current: 'Lokasi saat ini',
              address: 'Alamat',
              unknownAddress: 'Alamat tidak diketahui',
              phone: 'Telepon',
              noPhone: 'Tidak tersedia',
              noHospitals: 'Tidak ada rumah sakit pada rentang saat ini.',
              cta: 'Klik tombol “Buka halaman peta rujukan” di bawah untuk melihat marker dan navigasi.',
            }
          : locale === 'ms'
            ? {
                intro: 'Hospital berdekatan berdasarkan lokasi semasa anda telah disyorkan (utamakan TB/pernafasan):',
                current: 'Lokasi semasa',
                address: 'Alamat',
                unknownAddress: 'Alamat tidak diketahui',
                phone: 'Telefon',
                noPhone: 'Tiada',
                noHospitals: 'Tiada hospital ditemui dalam julat semasa.',
                cta: 'Klik butang “Buka halaman peta rujukan” di bawah untuk lihat penanda dan navigasi.',
              }
            : {
                intro: 'Nearby designated hospitals have been recommended based on your current location:',
                current: 'Current location',
                address: 'Address',
                unknownAddress: 'Unknown address',
                phone: 'Phone',
                noPhone: 'N/A',
                noHospitals: 'No hospitals were found in the current range.',
                cta: 'Use "Open designated map page" below for map markers and navigation.',
              };

  const topHospitals = hospitals.slice(0, 5);
  const listText = topHospitals
    .map((hospital, index) => {
      return [
        `${index + 1}. ${hospital.name} (${formatDistance(hospital.distanceMeter, locale)})`,
        `${copy.address}: ${hospital.address || copy.unknownAddress}`,
        `${copy.phone}: ${hospital.tel || copy.noPhone}`,
      ].join('\n');
    })
    .join('\n');

  return [
    copy.intro,
    `${copy.current}: ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`,
    listText || copy.noHospitals,
    copy.cta,
  ].join('\n');
}

function buildHospitalFailureReply(error: unknown, locale: AppLocale) {
  const message = error instanceof Error ? error.message : String(error || '');
  const copy =
    locale === 'zh'
      ? {
          missingKey: '医院推荐失败：未配置高德 API Key。请先在环境变量配置后重试。',
          insecure: '医院推荐失败：当前页面不是安全上下文。请通过 HTTPS 或 localhost 访问并重试。',
          denied: '医院推荐失败：定位权限被拒绝。请在浏览器地址栏权限设置中允许位置访问后重试。',
          timeout: '医院推荐失败：定位超时。请在网络稳定后重试。',
          unavailable: '医院推荐失败：无法获取设备定位，请检查系统定位服务是否开启。',
          invalidKey: '医院推荐失败：高德 Key 无效或权限不足，请检查 Key 类型与绑定配置。',
          network: '医院推荐失败：高德服务网络访问异常，请检查网络/代理后重试。',
          fallback: '医院推荐失败，请稍后重试。你仍可点击下方按钮进入定点推送页手动定位查询。',
        }
      : locale === 'th'
        ? {
            missingKey: 'แนะนำโรงพยาบาลไม่สำเร็จ: ยังไม่ได้ตั้งค่า Amap API key',
            insecure: 'แนะนำโรงพยาบาลไม่สำเร็จ: หน้านี้ไม่ใช่ secure context (โปรดใช้ HTTPS หรือ localhost)',
            denied: 'แนะนำโรงพยาบาลไม่สำเร็จ: ถูกปฏิเสธสิทธิ์ตำแหน่ง',
            timeout: 'แนะนำโรงพยาบาลไม่สำเร็จ: การระบุตำแหน่งหมดเวลา',
            unavailable: 'แนะนำโรงพยาบาลไม่สำเร็จ: ไม่สามารถดึงตำแหน่งอุปกรณ์ได้',
            invalidKey: 'แนะนำโรงพยาบาลไม่สำเร็จ: Amap key ไม่ถูกต้องหรือสิทธิ์ไม่พอ',
            network: 'แนะนำโรงพยาบาลไม่สำเร็จ: เชื่อมต่อบริการ Amap ไม่ได้',
            fallback: 'แนะนำโรงพยาบาลไม่สำเร็จ ลองใหม่อีกครั้ง หรือเปิดหน้าแผนที่จุดส่งต่อด้วยตนเอง',
          }
        : locale === 'id'
          ? {
              missingKey: 'Rekomendasi rumah sakit gagal: konfigurasi Amap API key belum ada.',
              insecure: 'Rekomendasi rumah sakit gagal: halaman bukan secure context. Gunakan HTTPS atau localhost.',
              denied: 'Rekomendasi rumah sakit gagal: izin lokasi ditolak.',
              timeout: 'Rekomendasi rumah sakit gagal: lokasi timeout.',
              unavailable: 'Rekomendasi rumah sakit gagal: lokasi perangkat tidak tersedia.',
              invalidKey: 'Rekomendasi rumah sakit gagal: Amap key tidak valid atau izin kurang.',
              network: 'Rekomendasi rumah sakit gagal: tidak dapat mengakses layanan Amap.',
              fallback: 'Rekomendasi rumah sakit gagal. Anda tetap dapat membuka halaman peta rujukan.',
            }
          : locale === 'ms'
            ? {
                missingKey: 'Cadangan hospital gagal: konfigurasi Amap API key belum tersedia.',
                insecure: 'Cadangan hospital gagal: halaman bukan secure context. Gunakan HTTPS atau localhost.',
                denied: 'Cadangan hospital gagal: kebenaran lokasi ditolak.',
                timeout: 'Cadangan hospital gagal: geolokasi tamat masa.',
                unavailable: 'Cadangan hospital gagal: lokasi peranti tidak tersedia.',
                invalidKey: 'Cadangan hospital gagal: Amap key tidak sah atau kebenaran tidak mencukupi.',
                network: 'Cadangan hospital gagal: tidak dapat mencapai perkhidmatan Amap.',
                fallback: 'Cadangan hospital gagal. Anda masih boleh buka halaman peta rujukan.',
              }
            : {
                missingKey: 'Hospital recommendation failed: missing Amap API key configuration.',
                insecure: 'Hospital recommendation failed: page is not in a secure context. Use HTTPS or localhost.',
                denied: 'Hospital recommendation failed: location permission denied. Allow location access and retry.',
                timeout: 'Hospital recommendation failed: location timeout. Please retry.',
                unavailable: 'Hospital recommendation failed: location is unavailable on this device/browser.',
                invalidKey: 'Hospital recommendation failed: invalid Amap key or insufficient permissions.',
                network: 'Hospital recommendation failed: unable to reach Amap service. Check network/proxy.',
                fallback: 'Hospital recommendation failed. You can still open the designated map page below.',
              };

  if (message.includes('MISSING_AMAP_WEB_KEY') || message.includes('MISSING_AMAP_JS_KEY') || message.includes('MISSING_AMAP_KEYS')) {
    return copy.missingKey;
  }
  if (message.includes('GEOLOCATION_INSECURE_CONTEXT')) return copy.insecure;
  if (message.includes('GEOLOCATION_DENIED')) return copy.denied;
  if (message.includes('GEOLOCATION_TIMEOUT')) return copy.timeout;
  if (message.includes('GEOLOCATION_UNAVAILABLE') || message.includes('GEOLOCATION_UNKNOWN')) return copy.unavailable;
  if (message.includes('10001') || message.includes('INVALID_USER_KEY')) return copy.invalidKey;
  if (message.includes('AMAP_HTTP_') || message.includes('Failed to fetch') || message.includes('NetworkError')) return copy.network;
  return copy.fallback;
}

async function getHospitalRecommendation(locale: AppLocale) {
  const config = getAmapConfigStatus();
  if (!config.configured) {
    throw new Error(config.reason || 'MISSING_AMAP_KEYS');
  }

  const point = await getCurrentPositionWithBrowserFallback();
  const hospitals = await fetchNearbyHospitals(point, { radiusMeter: 8000, pageSize: 8 });

  const payload: NearbyHospitalsMapPayload = {
    point,
    hospitals,
    source: 'qa',
    updatedAt: new Date().toISOString(),
  };

  saveNearbyHospitalsPayload(payload);

  if (hospitals.length === 0) {
    const copy =
      locale === 'zh'
        ? [
            '已完成定位，但当前范围内未检索到可展示医院。',
            `当前位置：${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`,
            '可点击下方“进入定点推送页”扩大范围继续查询。',
          ]
        : locale === 'th'
          ? [
              'ระบุตำแหน่งสำเร็จแล้ว แต่ไม่พบโรงพยาบาลในช่วงระยะปัจจุบัน',
              `ตำแหน่งปัจจุบัน: ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`,
              'คุณสามารถเปิดหน้าแผนที่จุดส่งต่อด้านล่างเพื่อขยายระยะค้นหา',
            ]
          : locale === 'id'
            ? [
                'Lokasi berhasil didapatkan, tetapi tidak ada rumah sakit dalam rentang saat ini.',
                `Lokasi saat ini: ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`,
                'Buka halaman peta rujukan di bawah untuk memperluas rentang pencarian.',
              ]
            : locale === 'ms'
              ? [
                  'Lokasi berjaya diperoleh, tetapi tiada hospital dalam julat semasa.',
                  `Lokasi semasa: ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`,
                  'Buka halaman peta rujukan di bawah untuk meluaskan julat carian.',
                ]
              : [
                  'Location acquired, but no hospitals were found in the current range.',
                  `Current location: ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`,
                  'Open the designated map page below to expand the query range.',
                ];
    return {
      payload,
      reply: copy.join('\n'),
    };
  }

  return {
    payload,
    reply: buildHospitalSuccessReply(point, hospitals, locale),
  };
}

export function PatientQA({ onOpenHospitalMap }: PatientQAProps) {
  const { locale, tr } = useI18n();
  const [messages, setMessages] = useState<ChatItem[]>([
    {
      sender: 'bot',
      text: tr('你好，这里是广西医科大学 TB 科智能助手，提供科普与流程建议，不替代线下诊断。'),
      followUps: buildFollowupQuestions('', '', locale),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [latestHospitalPayload, setLatestHospitalPayload] = useState<NearbyHospitalsMapPayload | null>(null);

  const docInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const formatSize = (size: number) => {
    if (size < 1024) return `${size} B`;
    const kb = size / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  const handleFiles = (kind: AttachmentKind, files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next = Array.from(files).map((file) => ({
      id: `${kind}-${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: file.name,
      size: formatSize(file.size),
      kind,
    }));
    setAttachments((prev) => [...prev, ...next]);
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((item) => item.id !== id));
  };

  const openHospitalMap = () => {
    const payload: NearbyHospitalsMapPayload =
      latestHospitalPayload ||
      {
        point: null,
        hospitals: [],
        source: 'qa',
        updatedAt: new Date().toISOString(),
      };

    saveNearbyHospitalsPayload(payload);

    if (onOpenHospitalMap) {
      onOpenHospitalMap(payload);
      return;
    }
    window.location.assign('/nearby-hospitals/map');
  };

  const send = async (text: string) => {
    if (loading) return;

    const q = text.trim();
    if (!q && attachments.length === 0) return;

    const outgoing: ChatItem = {
      sender: 'user',
      text: q || tr('已上传附件'),
      attachments: attachments.length ? attachments : undefined,
    };

    setMessages((prev) => [...prev, outgoing]);
    setInput('');
    setAttachments([]);
    setLoading(true);

    try {
      const isHospitalQuery = isHospitalIntent(q);
      let reply = '';
      let showHospitalMapButton = false;

      if (isHospitalQuery) {
        showHospitalMapButton = true;
        try {
          const recommendation = await getHospitalRecommendation(locale);
          reply = recommendation.reply;
          setLatestHospitalPayload(recommendation.payload);
        } catch (error) {
          reply = buildHospitalFailureReply(error, locale);
        }
      } else {
        reply = await askDeepseek(q, undefined, locale);
      }

      setMessages((prev) => {
        const botMessage: ChatItem = {
          sender: 'bot',
          text: reply,
          followUps: buildFollowupQuestions(reply, q, locale),
          showHospitalMapButton,
        };
        return [...prev, botMessage];
      });
      speakText(
        reply,
        locale,
        () => setSpeaking(true),
        () => setSpeaking(false)
      );
    } catch {
      const fallback = tr('当前问答服务暂不可用，请稍后重试。');
      setMessages((prev) => [
        ...prev,
        { sender: 'bot', text: fallback, followUps: buildFollowupQuestions(fallback, q, locale) },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 h-full flex gap-4 p-4 bg-[rgb(var(--bg))] overflow-hidden">
      <div className="flex-1 min-w-0 aurora-card glass-card-hover flex flex-col">
        <div className="p-3 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-200 text-sm">
            <MessageCircle className="h-4 w-4 text-teal-400" />
            {tr('智能问答')}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            <ShieldAlert className="h-3 w-3 text-amber-400" />
            {tr('仅供科普与流程建议，不替代医生诊断')}
          </div>
        </div>

        <div className="flex-1 min-h-0 p-4 space-y-4 overflow-y-auto overflow-x-hidden">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] min-w-0 px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${
                  msg.sender === 'user'
                    ? 'bg-teal-900 text-teal-50 border border-teal-600'
                    : 'bg-gray-900 text-gray-200 border border-gray-700'
                }`}
              >
                <div className="break-words [overflow-wrap:anywhere]">{msg.text}</div>
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {msg.attachments.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center gap-2 text-[11px] bg-gray-800 border border-gray-700 rounded-lg px-2 py-1"
                      >
                        <span className="text-gray-300">{attachmentLabel(file.kind, tr)}</span>
                        <span className="text-gray-400">{file.name}</span>
                        <span className="text-gray-500">{file.size}</span>
                      </div>
                    ))}
                  </div>
                )}
                {msg.sender === 'bot' && msg.showHospitalMapButton && (
                  <div className="mt-3 pt-2 border-t border-gray-700/80 space-y-2">
                    <div className="text-[11px] text-gray-400 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {tr('点击按钮跳转定点推送页查看地图点位并导航')}
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        className="rounded border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-2 py-1 text-[11px] text-gray-300 hover:bg-[rgb(var(--bg))]"
                        onClick={openHospitalMap}
                      >
                        {tr('进入定点推送页')}
                      </button>
                    </div>
                  </div>
                )}
                {msg.sender === 'bot' && msg.followUps && msg.followUps.length > 0 && (
                  <div className="qa-followup-wrap mt-3 pt-2 border-t border-gray-700/80">
                    <div className="qa-followup-title text-[11px] mb-2">{tr('追问建议')}</div>
                    <div className="flex flex-wrap gap-2">
                      {msg.followUps.map((question) => (
                        <button
                          key={`${idx}-${question}`}
                          onClick={() => send(question)}
                          disabled={loading}
                          className="qa-followup-btn text-left text-[12px] px-2 py-1.5 rounded disabled:opacity-50 break-words [overflow-wrap:anywhere]"
                        >
                          {question}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && <div className="text-xs text-gray-500">{tr('生成回答中...')}</div>}
        </div>

        <div className="p-3 border-t border-gray-700 space-y-2">
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-2 text-[11px] bg-gray-800 border border-gray-700 rounded-lg px-2 py-1"
                >
                  <span className="text-gray-300">{attachmentLabel(file.kind, tr)}</span>
                  <span className="text-gray-400">{file.name}</span>
                  <span className="text-gray-500">{file.size}</span>
                  <button
                    onClick={() => removeAttachment(file.id)}
                    className="text-gray-400 hover:text-gray-200"
                    title={tr('移除')}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2 bg-gray-900 border border-gray-700 rounded-2xl p-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => docInputRef.current?.click()}
                className="p-2 rounded-full border border-gray-700 text-gray-300 hover:text-gray-100 hover:border-gray-600"
                title={tr('上传文档')}
              >
                <FileText className="h-4 w-4" />
              </button>
              <button
                onClick={() => imageInputRef.current?.click()}
                className="p-2 rounded-full border border-gray-700 text-gray-300 hover:text-gray-100 hover:border-gray-600"
                title={tr('上传图片')}
              >
                <ImageIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => audioInputRef.current?.click()}
                className="p-2 rounded-full border border-gray-700 text-gray-300 hover:text-gray-100 hover:border-gray-600"
                title={tr('上传语音')}
              >
                <Mic className="h-4 w-4" />
              </button>
              <button
                onClick={() => videoInputRef.current?.click()}
                className="p-2 rounded-full border border-gray-700 text-gray-300 hover:text-gray-100 hover:border-gray-600"
                title={tr('上传视频')}
              >
                <Video className="h-4 w-4" />
              </button>
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={tr('输入问题，支持多种附件')}
              className={uiStyles.input.textarea + ' min-h-[64px] flex-1 border-none bg-transparent'}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void send(input);
                }
              }}
            />
            <button
              onClick={() => {
                void send(input);
              }}
              disabled={loading}
              className={
                uiStyles.button.primary +
                ' flex items-center gap-2 justify-center disabled:opacity-50 disabled:cursor-not-allowed'
              }
            >
              <Send className="h-4 w-4" />
              {tr('发送')}
            </button>
            <button
              onClick={() => {
                stopSpeaking();
                setSpeaking(false);
              }}
              className={uiStyles.button.secondary + ' flex items-center gap-2 justify-center'}
            >
              <Pause className="h-4 w-4" />
              {tr('停止朗读')}
            </button>
          </div>

          <input
            ref={docInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt"
            className="hidden"
            multiple
            onChange={(e) => handleFiles('doc', e.target.files)}
          />
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            multiple
            onChange={(e) => handleFiles('image', e.target.files)}
          />
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            multiple
            onChange={(e) => handleFiles('audio', e.target.files)}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            multiple
            onChange={(e) => handleFiles('video', e.target.files)}
          />
        </div>
      </div>

      <div className="w-[320px] h-full overflow-y-auto space-y-3 pr-1">
        <div className="aurora-card glass-card-hover p-3">
          <DigitalHumanAvatar speaking={speaking} />
          <div className="text-xs text-gray-500 mt-2 text-center">
            {tr('状态：')}
            {speaking ? tr('数字人正在朗读') : tr('待机')}
          </div>
        </div>

        <div className="aurora-card glass-card-hover p-3 space-y-3">
          <div className="flex items-center gap-2 text-gray-200 text-sm">
            <Sparkles className="h-4 w-4 text-blue-400" />
            {tr('快速提问')}
          </div>
          <div className="space-y-2">
            {quickQuestions.map((q) => (
              <button
                key={q}
                onClick={() => {
                  void send(q);
                }}
                className="w-full text-left px-3 py-2 rounded bg-gray-900 hover:bg-gray-800 text-sm text-gray-200 border border-gray-700"
              >
                {tr(q)}
              </button>
            ))}
          </div>
          <div className="text-xs text-gray-500 border border-gray-700 rounded p-2">
            {tr('提示：若出现高热、咳血、呼吸困难等急症，请立即线下就医')}
          </div>
        </div>
      </div>
    </div>
  );
}
