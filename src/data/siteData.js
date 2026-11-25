export const COMPANY_INFO = {
  name: 'DN TECH SOLUTIONS', tagline: 'IDEAS | TECHNOLOGY | GROWTH',
  founder: 'Dharma Routhu', designation: 'Java Developer & Software Consultant',
  email: 'dharma.routhu009@gmail.com', phoneDisplay: '+91 81436 02769',
  phoneRaw: '+918143602769', whatsappNumber: '918143602769',
  linkedin: 'https://linkedin.com/in/dharmarouthu009',
  location: 'Hyderabad, Telangana, India',
}

export const buildVCardString = () => [
  'BEGIN:VCARD', 'VERSION:3.0', 'N:Routhu;Dharma;;;',
  `FN:${COMPANY_INFO.founder}`, `ORG:${COMPANY_INFO.name}`,
  `TITLE:${COMPANY_INFO.designation}`,
  `TEL;TYPE=CELL,VOICE:${COMPANY_INFO.phoneRaw}`,
  `EMAIL;TYPE=PREF,INTERNET:${COMPANY_INFO.email}`,
  `URL:${COMPANY_INFO.linkedin}`,
  `ADR;TYPE=WORK:;;${COMPANY_INFO.location};;;;`,
  `NOTE:${COMPANY_INFO.designation} at ${COMPANY_INFO.name} | ${COMPANY_INFO.tagline}`,
  'END:VCARD',
].join('\r\n')
export const QR_PROJECTS = [
  {
    name: 'Synergy',
    description: 'QR based verification and tracking solutions for Synergy operations.',
    tags: ['QR Generation', 'Verification', 'Tracking']
  },
  {
    name: 'Corteva',
    description: 'QR integration for agricultural product authentication and farmer engagement.',
    tags: ['QR Scanning', 'Product Authentication', 'Farmers']
  },
  {
    name: 'Agri Sciences',
    description: 'QR enabled data collection and reporting for Agri Sciences research.',
    tags: ['Data Collection', 'Research', 'QR']
  },
  {
    name: 'Shakthi Seeds',
    description: 'QR codes for seed packaging to provide traceability and planting guides.',
    tags: ['Traceability', 'Packaging', 'Guides']
  },
  {
    name: 'Pioneer Farmer Connect',
    description: 'QR platform connecting pioneer farmers with resources and data.',
    tags: ['QR Collaboration', 'Farmer Community', 'Data Exchange']
  }
];

