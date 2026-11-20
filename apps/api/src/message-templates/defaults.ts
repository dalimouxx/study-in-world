// Modèles de messages fournis par défaut à chaque agence (créés au seed, à la création d'une agence, et
// complétés à la première consultation s'il en manque). L'agence peut ensuite tout réécrire dans
// Paramètres → Messages, ou rétablir ces textes.

export type DefaultTemplate = {
  key: string;
  channel: 'WHATSAPP' | 'EMAIL';
  isSystem: boolean;
  nameFr: string;
  nameAr: string;
  subjectFr?: string;
  subjectAr?: string;
  bodyFr: string;
  bodyAr: string;
};

const SIGN_FR = '\n\n{agence} · {telephone_agence}';
const SIGN_AR = '\n\n{agence} · {telephone_agence}';

const pair = (
  key: string, nameFr: string, nameAr: string,
  wa: { fr: string; ar: string },
  mail: { subjectFr: string; subjectAr: string; fr: string; ar: string },
): DefaultTemplate[] => [
  { key, channel: 'WHATSAPP', isSystem: true, nameFr, nameAr, bodyFr: wa.fr, bodyAr: wa.ar },
  { key, channel: 'EMAIL', isSystem: true, nameFr, nameAr, subjectFr: mail.subjectFr, subjectAr: mail.subjectAr, bodyFr: mail.fr + SIGN_FR, bodyAr: mail.ar + SIGN_AR },
];

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  ...pair('APPOINTMENT_TOMORROW', 'Rappel de rendez-vous', 'تذكير بالموعد',
    {
      fr: 'Bonjour {prenom} 👋 Petit rappel : votre rendez-vous avec {agence} est demain, le {date} à {heure} · {lieu}. À demain !',
      ar: 'مرحبًا {prenom} 👋 تذكير: موعدك مع {agence} غدًا، {date} على الساعة {heure} · {lieu}. إلى الغد!',
    },
    {
      subjectFr: 'Rappel : votre rendez-vous demain à {heure}', subjectAr: 'تذكير: موعدك غدًا على الساعة {heure}',
      fr: 'Bonjour {prenom},\n\nNous vous rappelons votre rendez-vous demain, le {date} à {heure}.\nLieu : {lieu}\n\nEn cas d’empêchement, merci de nous prévenir.',
      ar: 'مرحبًا {prenom}،\n\nنذكّرك بموعدك غدًا، {date} على الساعة {heure}.\nالمكان: {lieu}\n\nفي حال تعذّر الحضور، يرجى إعلامنا.',
    }),
  ...pair('VISA_APPOINTMENT_TOMORROW', 'Rappel de rendez-vous visa', 'تذكير بموعد التأشيرة',
    {
      fr: 'Bonjour {prenom}, votre rendez-vous visa ({pays}) est demain, le {date} à {heure}. N’oubliez pas votre passeport et tous les documents du dossier. Bonne chance ! 🍀',
      ar: 'مرحبًا {prenom}، موعد التأشيرة ({pays}) غدًا، {date} على الساعة {heure}. لا تنسَ جواز السفر وكل وثائق الملف. بالتوفيق! 🍀',
    },
    {
      subjectFr: 'Rappel : rendez-vous visa demain', subjectAr: 'تذكير: موعد التأشيرة غدًا',
      fr: 'Bonjour {prenom},\n\nVotre rendez-vous visa ({pays}) a lieu demain, le {date} à {heure}.\nPensez à emporter votre passeport et l’ensemble des documents du dossier.\n\nBonne chance !',
      ar: 'مرحبًا {prenom}،\n\nموعد التأشيرة ({pays}) غدًا، {date} على الساعة {heure}.\nتذكّر أن تحمل جواز السفر وكل وثائق الملف.\n\nبالتوفيق!',
    }),
  ...pair('PROSPECT_FOLLOW_UP', 'Relance prospect', 'متابعة عميل محتمل',
    {
      fr: 'Bonjour {prenom}, c’est {agence} 😊 Avez-vous pu réfléchir à votre projet d’études à l’étranger ? Je reste disponible pour répondre à vos questions.',
      ar: 'مرحبًا {prenom}، معك {agence} 😊 هل فكّرت في مشروع دراستك بالخارج؟ أنا في الخدمة للإجابة عن كل أسئلتك.',
    },
    {
      subjectFr: 'Votre projet d’études à l’étranger', subjectAr: 'مشروع دراستك بالخارج',
      fr: 'Bonjour {prenom},\n\nNous revenons vers vous au sujet de votre projet d’études à l’étranger. Souhaitez-vous que nous en parlions ?',
      ar: 'مرحبًا {prenom}،\n\nنتواصل معك بخصوص مشروع دراستك بالخارج. هل تودّ أن نتحدث عنه؟',
    }),
  ...pair('INVOICE_OVERDUE', 'Rappel de paiement', 'تذكير بالدفع',
    {
      fr: 'Bonjour {prenom}, sauf erreur de notre part, la facture {facture} présente un reste à payer de {montant} {devise}. Merci de régulariser dès que possible 🙏',
      ar: 'مرحبًا {prenom}، ما لم نكن مخطئين، تبقّى من الفاتورة {facture} مبلغ {montant} {devise}. نرجو التسوية في أقرب وقت 🙏',
    },
    {
      subjectFr: 'Rappel de paiement — facture {facture}', subjectAr: 'تذكير بالدفع — الفاتورة {facture}',
      fr: 'Bonjour {prenom},\n\nSauf erreur de notre part, la facture {facture} présente un reste à payer de {montant} {devise}.\nMerci de régulariser dès que possible. Si le paiement a déjà été effectué, merci d’ignorer ce message.',
      ar: 'مرحبًا {prenom}،\n\nما لم نكن مخطئين، تبقّى من الفاتورة {facture} مبلغ {montant} {devise}.\nنرجو التسوية في أقرب وقت. إذا كنت قد دفعت بالفعل، يرجى تجاهل هذه الرسالة.',
    }),
  ...pair('DOCUMENT_REJECTED', 'Document à renvoyer', 'وثيقة يجب إعادة إرسالها',
    {
      fr: 'Bonjour {prenom}, votre document « {document} » n’a pas pu être accepté : {raison}. Pouvez-vous nous en renvoyer une nouvelle version ? Merci !',
      ar: 'مرحبًا {prenom}، لم نتمكّن من قبول الوثيقة «{document}»: {raison}. هل يمكنك إرسال نسخة جديدة؟ شكرًا!',
    },
    {
      subjectFr: 'Document à renvoyer : {document}', subjectAr: 'وثيقة يجب إعادة إرسالها: {document}',
      fr: 'Bonjour {prenom},\n\nVotre document « {document} » n’a pas pu être accepté.\nRaison : {raison}\n\nVous pouvez déposer une nouvelle version depuis votre espace candidat.',
      ar: 'مرحبًا {prenom}،\n\nلم نتمكّن من قبول الوثيقة «{document}».\nالسبب: {raison}\n\nيمكنك إرسال نسخة جديدة من فضاء المترشح.',
    }),
  {
    key: 'DAILY_DIGEST', channel: 'EMAIL', isSystem: true, nameFr: 'Récapitulatif du matin', nameAr: 'ملخص الصباح',
    subjectFr: 'Votre journée du {date}', subjectAr: 'يومك {date}',
    bodyFr: 'Bonjour {prenom},\n\nVoici ce qui vous attend aujourd’hui :', bodyAr: 'مرحبًا {prenom}،\n\nإليك ما ينتظرك اليوم:',
  },
  {
    key: 'DOCUMENTS_LIST', channel: 'WHATSAPP', isSystem: false, nameFr: 'Documents à fournir', nameAr: 'الوثائق المطلوبة',
    bodyFr: 'Bonjour {prenom}, voici les documents à préparer pour votre dossier :\n• Passeport valide\n• Diplômes et relevés de notes\n• Photo d’identité récente\n• Certificat de langue (si disponible)\n• Relevé bancaire\nVous pouvez les déposer directement dans votre espace candidat.',
    bodyAr: 'مرحبًا {prenom}، إليك الوثائق التي يجب تحضيرها لملفك:\n• جواز سفر صالح\n• الشهادات وكشوف الأعداد\n• صورة شمسية حديثة\n• شهادة اللغة (إن وُجدت)\n• كشف حساب بنكي\nيمكنك إيداعها مباشرة في فضاء المترشح.',
  },
  {
    key: 'VISA_STEPS', channel: 'WHATSAPP', isSystem: false, nameFr: 'Étapes du visa', nameAr: 'مراحل التأشيرة',
    bodyFr: 'Bonjour {prenom}, voici les étapes de votre visa ({pays}) :\n1. Réception de l’admission\n2. Préparation du dossier visa\n3. Prise de rendez-vous\n4. Dépôt au centre de visa\n5. Décision et retrait du passeport\nNous vous accompagnons à chaque étape !',
    bodyAr: 'مرحبًا {prenom}، إليك مراحل تأشيرتك ({pays}):\n1. استلام القبول\n2. تحضير ملف التأشيرة\n3. حجز الموعد\n4. الإيداع في مركز التأشيرات\n5. القرار واستلام الجواز\nنرافقك في كل مرحلة!',
  },
  {
    key: 'WELCOME', channel: 'WHATSAPP', isSystem: false, nameFr: 'Bienvenue', nameAr: 'ترحيب',
    bodyFr: 'Bonjour {prenom} et bienvenue chez {agence} ! 🎓 Nous sommes ravis de vous accompagner dans votre projet d’études à l’étranger.',
    bodyAr: 'مرحبًا {prenom} وأهلًا بك في {agence}! 🎓 يسعدنا مرافقتك في مشروع دراستك بالخارج.',
  },
];
