import React, { useState, useEffect, useMemo } from 'react';
import {
  Menu,
  X,
  ArrowUpRight,
  ArrowRight,
  ArrowUp,
  MessageSquare,
  MessageCircle,
  Code2,
  Layers,
  QrCode,
  Cloud,
  ShieldCheck,
  Server,
  Smartphone,
  Sparkles,
  Lightbulb,
  Award,
  Handshake,
  MapPin,
  UserCheck,
  Globe,
  CloudCog,
  Wrench,
  CheckCircle2,
  ShieldAlert,
  Boxes,
  Users,
  GraduationCap,
  Building2,
  Network,
  Cpu,
  Layout,
  Database,
  Sliders,
  TrendingUp,
  Lock,
  Headphones,
  Target,
  Clock,
  Phone,
  Mail,
  User,
  Briefcase,
  Linkedin,
  Download,
  FlipHorizontal,
  Send,
  Info,
} from 'lucide-react';

// ============================================================================
// 1. PURE JAVASCRIPT QR CODE MATRIX GENERATOR (ISO/IEC 18004 Byte Mode, ECC L)
//    Produces a real, genuine, camera-scannable QR code for the vCard payload
// ============================================================================
const QR_EC_CODEWORDS = [
  0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28,
  28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
];
const QR_NUM_BLOCKS = [
  0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7,
  8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25,
];

function getNumRawDataModules(ver) {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}

function getNumDataCodewords(ver) {
  return (
    Math.floor(getNumRawDataModules(ver) / 8) -
    QR_EC_CODEWORDS[ver] * QR_NUM_BLOCKS[ver]
  );
}

function gfMultiply(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function computeReedSolomonDivisor(degree) {
  const result = new Uint8Array(degree);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

function computeReedSolomonRemainder(data, divisor) {
  const result = new Uint8Array(divisor.length);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ result[0];
    result.copyWithin(0, 1);
    result[result.length - 1] = 0;
    for (let j = 0; j < divisor.length; j++) {
      result[j] ^= gfMultiply(divisor[j], factor);
    }
  }
  return result;
}

function generateQrMatrix(text) {
  const encoder = new TextEncoder();
  const dataBytes = Array.from(encoder.encode(text));

  let version = 1;
  for (let v = 1; v <= 40; v++) {
    const ccBits = v <= 9 ? 8 : 16;
    const capacityBits = getNumDataCodewords(v) * 8;
    if (4 + ccBits + dataBytes.length * 8 <= capacityBits) {
      version = v;
      break;
    }
  }

  const bitBuffer = [];
  const appendBits = (val, len) => {
    for (let i = len - 1; i >= 0; i--) {
      bitBuffer.push((val >>> i) & 1);
    }
  };

  // Byte mode indicator (0100)
  appendBits(0b0100, 4);
  appendBits(dataBytes.length, version <= 9 ? 8 : 16);
  for (const b of dataBytes) appendBits(b, 8);

  const dataCapacityBits = getNumDataCodewords(version) * 8;
  appendBits(0, Math.min(4, dataCapacityBits - bitBuffer.length));
  while (bitBuffer.length % 8 !== 0) bitBuffer.push(0);

  let padByte = 0xec;
  while (bitBuffer.length < dataCapacityBits) {
    appendBits(padByte, 8);
    padByte = padByte === 0xec ? 0x11 : 0xec;
  }

  const dataCodewords = new Uint8Array(bitBuffer.length / 8);
  for (let i = 0; i < dataCodewords.length; i++) {
    let byteVal = 0;
    for (let b = 0; b < 8; b++) {
      byteVal = (byteVal << 1) | bitBuffer[i * 8 + b];
    }
    dataCodewords[i] = byteVal;
  }

  // Error correction & block interleaving
  const numBlocks = QR_NUM_BLOCKS[version];
  const blockEccLen = QR_EC_CODEWORDS[version];
  const rawCodewords = Math.floor(getNumRawDataModules(version) / 8);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);
  const rsDiv = computeReedSolomonDivisor(blockEccLen);

  const blocks = [];
  let k = 0;
  for (let i = 0; i < numBlocks; i++) {
    const datLen = shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1);
    const dat = dataCodewords.slice(k, k + datLen);
    k += datLen;
    const ecc = computeReedSolomonRemainder(dat, rsDiv);
    const fullBlock = new Uint8Array(shortBlockLen + 1);
    fullBlock.set(dat);
    if (i < numShortBlocks) fullBlock[shortBlockLen - blockEccLen] = 0;
    fullBlock.set(ecc, shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
    blocks.push({ dat, ecc });
  }

  const allCodewords = [];
  const maxDatLen = blocks[blocks.length - 1].dat.length;
  for (let i = 0; i < maxDatLen; i++) {
    for (let j = 0; j < numBlocks; j++) {
      if (i < blocks[j].dat.length) allCodewords.push(blocks[j].dat[i]);
    }
  }
  for (let i = 0; i < blockEccLen; i++) {
    for (let j = 0; j < numBlocks; j++) {
      allCodewords.push(blocks[j].ecc[i]);
    }
  }

  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () => Array(size).fill(false));
  const isFunction = Array.from({ length: size }, () => Array(size).fill(false));

  const setFunctionModule = (x, y, isDark) => {
    if (x >= 0 && x < size && y >= 0 && y < size) {
      modules[y][x] = isDark;
      isFunction[y][x] = true;
    }
  };

  // Timing patterns
  for (let i = 0; i < size; i++) {
    setFunctionModule(6, i, i % 2 === 0);
    setFunctionModule(i, 6, i % 2 === 0);
  }

  // Alignment patterns
  const alignPos = [];
  if (version > 1) {
    const numAlign = Math.floor(version / 7) + 2;
    const step =
      version === 32
        ? 26
        : Math.ceil((size - 13) / (numAlign * 2 - 2)) * 2;
    for (let i = 0, pos = size - 7; i < numAlign - 1; i++, pos -= step) {
      alignPos.unshift(pos);
    }
    alignPos.unshift(6);
  }
  for (let i = 0; i < alignPos.length; i++) {
    for (let j = 0; j < alignPos.length; j++) {
      if (
        (i === 0 && j === 0) ||
        (i === 0 && j === alignPos.length - 1) ||
        (i === alignPos.length - 1 && j === 0)
      ) {
        continue;
      }
      const cx = alignPos[i];
      const cy = alignPos[j];
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          setFunctionModule(
            cx + dx,
            cy + dy,
            Math.max(Math.abs(dx), Math.abs(dy)) !== 1
          );
        }
      }
    }
  }

  // Finder patterns + separators
  const drawFinder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        setFunctionModule(cx + dx, cy + dy, dist !== 2 && dist !== 4);
      }
    }
  };
  drawFinder(3, 3);
  drawFinder(size - 4, 3);
  drawFinder(3, size - 4);

  // Reserve format & version info areas
  for (let i = 0; i < 9; i++) {
    setFunctionModule(8, i, false);
    setFunctionModule(i, 8, false);
  }
  for (let i = 0; i < 8; i++) {
    setFunctionModule(size - 1 - i, 8, false);
    setFunctionModule(8, size - 1 - i, false);
  }
  setFunctionModule(8, size - 8, true);

  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const vBits = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const bit = ((vBits >>> i) & 1) !== 0;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFunctionModule(a, b, bit);
      setFunctionModule(b, a, bit);
    }
  }

  // Zigzag codeword placement
  let bitIdx = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!isFunction[y][x] && bitIdx < allCodewords.length * 8) {
          const dark =
            ((allCodewords[bitIdx >>> 3] >>> (7 - (bitIdx & 7))) & 1) !== 0;
          modules[y][x] = dark;
          bitIdx++;
        }
      }
    }
  }

  // Apply Mask Pattern 0 ((x + y) % 2 === 0) and write Format Bits (ECC L = 01, Mask 0 = 000)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!isFunction[y][x] && (x + y) % 2 === 0) {
        modules[y][x] = !modules[y][x];
      }
    }
  }

  const formatData = (0b01 << 3) | 0; // ECC L + mask 0
  let rem = formatData;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const formatBits = ((formatData << 10) | rem) ^ 0x5412;

  for (let i = 0; i <= 5; i++) setFunctionModule(8, i, ((formatBits >>> i) & 1) !== 0);
  setFunctionModule(8, 7, ((formatBits >>> 6) & 1) !== 0);
  setFunctionModule(8, 8, ((formatBits >>> 7) & 1) !== 0);
  setFunctionModule(7, 8, ((formatBits >>> 8) & 1) !== 0);
  for (let i = 9; i < 15; i++) setFunctionModule(14 - i, 8, ((formatBits >>> i) & 1) !== 0);

  for (let i = 0; i < 8; i++) setFunctionModule(size - 1 - i, 8, ((formatBits >>> i) & 1) !== 0);
  for (let i = 8; i < 15; i++) setFunctionModule(8, size - 15 + i, ((formatBits >>> i) & 1) !== 0);
  setFunctionModule(8, size - 8, true);

  return modules;
}

const ScannableQRCode = ({ value, size = 152 }) => {
  const matrix = useMemo(() => generateQrMatrix(value), [value]);
  const count = matrix.length;
  const quietZone = 3;
  const totalDim = count + quietZone * 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${totalDim} ${totalDim}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label="Scannable vCard QR Code for Dharma Routhu - DN TECH SOLUTIONS"
      style={{ display: 'block', width: `${size}px`, height: `${size}px` }}
    >
      <rect width={totalDim} height={totalDim} fill="#FFFFFF" />
      {matrix.map((row, y) =>
        row.map((cell, x) =>
          cell ? (
            <rect
              key={`${x}-${y}`}
              x={x + quietZone}
              y={y + quietZone}
              width={1}
              height={1}
              fill="#020B1C"
            />
          ) : null
        )
      )}
    </svg>
  );
};

// ============================================================================
// 2. COMPANY DATA & CONTENT
// ============================================================================
const COMPANY_INFO = {
  name: 'DN TECH SOLUTIONS',
  tagline: 'IDEAS | TECHNOLOGY | GROWTH',
  founder: 'Dharma Routhu',
  designation: 'Java Developer & Software Consultant',
  email: 'dharma.routhu009@gmail.com',
  phoneDisplay: '+91 81436 02769',
  phoneRaw: '+918143602769',
  whatsappNumber: '918143602769',
  linkedin: 'https://linkedin.com/in/dharmarouthu009',
  location: 'Hyderabad, Telangana, India',
};

const PAGE_VIEWS = [
  { id: 'all', label: 'Complete Site' },
  { id: 'home', label: 'Home & Visiting Card' },
  { id: 'services', label: 'Services & Tech Stack' },
  { id: 'contact', label: 'Contact & vCard QR' },
];

const NAV_ITEMS = [
  { label: 'Home', href: '#home' },
  { label: 'About', href: '#about' },
  { label: 'Visiting Card', href: '#visiting-card' },
  { label: 'Services', href: '#services' },
  { label: 'Technologies', href: '#technologies' },
  { label: 'Process', href: '#process' },
  { label: 'Contact', href: '#contact' },
];

const HERO_HIGHLIGHTS = [
  { title: 'Custom Software Development', icon: Code2 },
  { title: 'Enterprise Applications', icon: Layers },
  { title: 'QR Code Solutions', icon: QrCode },
  { title: 'Cloud & Mobile Technologies', icon: Cloud },
];

const ABOUT_PILLARS = [
  {
    title: 'Innovation',
    description:
      'Applying modern software patterns, QR verification intelligence, and cloud-native architectures to solve real operational bottlenecks.',
    icon: Lightbulb,
  },
  {
    title: 'Quality',
    description:
      'Clean, maintainable codebases built with strict engineering standards, thorough testing, and long-term performance in mind.',
    icon: Award,
  },
  {
    title: 'Reliability',
    description:
      'Resilient backend systems and secure database architectures engineered for high availability across business-critical workflows.',
    icon: ShieldCheck,
  },
  {
    title: 'Customer Satisfaction',
    description:
      'Transparent communication, milestone-driven execution, and dedicated technical support tailored to every client organization.',
    icon: Handshake,
  },
];

const SERVICES_DATA = [
  {
    id: 'qr-solutions',
    code: 'A',
    title: 'QR Code Based Applications',
    icon: QrCode,
    shortDescription:
      'QR Generation | Validation | Tracking | Fraud Detection and complete QR-driven business ecosystems.',
    overview:
      'We architect secure QR-driven platforms that connect physical products, assets, and personnel with instant cloud verification and audit trails.',
    items: [
      'QR Code Generation',
      'QR Code Scanning',
      'QR Code Validation',
      'QR Code Tracking',
      'QR-Based Attendance Systems',
      'QR-Based Inventory Management',
      'QR-Based Product Verification',
      'QR Fraud Detection Solutions',
      'QR-Based Digital Information Systems',
    ],
  },
  {
    id: 'web-development',
    code: 'B',
    title: 'Web Application Development',
    icon: Globe,
    shortDescription:
      'Enterprise & Custom Business Applications, dashboards, management systems, and workflow automation.',
    overview:
      'From enterprise web platforms to public-sector and NGO portals, we build responsive, role-based web systems integrated with REST APIs.',
    items: [
      'Custom Business Applications',
      'Enterprise Web Applications',
      'Admin Dashboards',
      'Management Information Systems',
      'Government & NGO Applications',
      'Workflow Automation',
      'Reporting & Analytics',
      'REST API Integration',
    ],
  },
  {
    id: 'java-development',
    code: 'C',
    title: 'Java Application Development',
    icon: Server,
    shortDescription:
      'Java 17 / 21 | Spring Boot 3 | Spring Security | Hibernate | REST APIs and scalable enterprise backends.',
    overview:
      'Specialized enterprise Java engineering designed for data integrity, transaction safety, and seamless relational database performance.',
    items: [
      'Core Java',
      'Advanced Java',
      'Java 8 / Java 17 / Java 21',
      'Spring Framework',
      'Spring Boot 3',
      'Spring MVC',
      'Spring Security',
      'Hibernate',
      'JPA',
      'RESTful APIs',
      'Microservices Architecture',
      'MySQL / SQL Server Integration',
    ],
  },
  {
    id: 'mobile-development',
    code: 'D',
    title: 'Android & iOS Application Development',
    icon: Smartphone,
    shortDescription:
      'Android & iOS (Native / Hybrid) mobile apps with API integration, push notifications, and QR scanning.',
    overview:
      'We deliver fast, field-ready Android and iOS applications empowering teams and customers with real-time mobile dashboards and scanning tools.',
    items: [
      'Android Application Development',
      'iOS Application Development',
      'Cross-Platform Mobile Applications',
      'API Integration',
      'Push Notifications',
      'Mobile Dashboard Applications',
      'QR Scanner Integration',
    ],
  },
  {
    id: 'cloud-devops',
    code: 'E',
    title: 'Cloud & DevOps Solutions',
    icon: CloudCog,
    shortDescription:
      'AWS (EC2, S3, RDS) | CI/CD | DevOps | Application Hosting and SSL-secured production setups.',
    overview:
      'Streamline software releases and infrastructure reliability with automated GitHub Actions, Azure DevOps, and AWS cloud environments.',
    items: [
      'AWS Cloud Deployment',
      'AWS EC2',
      'AWS S3',
      'AWS RDS',
      'CI/CD Pipeline Setup',
      'GitHub Actions',
      'Azure DevOps',
      'Application Hosting',
      'Server Configuration',
      'Domain & SSL Configuration',
    ],
  },
  {
    id: 'maintenance-support',
    code: 'F',
    title: 'Software Maintenance & Support',
    icon: Wrench,
    shortDescription:
      'Enhancements | Bug Fixes | Version Upgrades | Performance & Security Improvements and modernization.',
    overview:
      'Keep existing business applications fast, secure, and modern with structured refactoring, version upgrades, and proactive maintenance.',
    items: [
      'Existing Application Maintenance',
      'Legacy Application Modernization',
      'Spring MVC to Spring Boot Migration',
      'Java Version Upgrades',
      'Bug Fixing',
      'Performance Optimization',
      'Security Improvements',
      'Database Optimization',
      'Application Enhancements',
    ],
  },
];

const SPECIALIZED_SOLUTIONS = [
  {
    number: '01',
    title: 'QR-Based Fraud Detection Systems',
    description:
      'Cryptographically verifiable QR serialization to detect counterfeit goods, duplicate scans, and unauthorized distribution.',
    icon: ShieldAlert,
  },
  {
    number: '02',
    title: 'Digital Attendance Management',
    description:
      'Contactless QR and mobile check-in platforms with real-time shift logs, geolocation validation, and automated reports.',
    icon: UserCheck,
  },
  {
    number: '03',
    title: 'Inventory & Asset Management',
    description:
      'End-to-end stock tracking, warehouse movement audits, and lifecycle asset tagging using instant QR code scanning.',
    icon: Boxes,
  },
  {
    number: '04',
    title: 'Employee Management Systems',
    description:
      'Centralized workforce records, role assignments, leave workflows, performance tracking, and operational dashboards.',
    icon: Users,
  },
  {
    number: '05',
    title: 'School & Education Management',
    description:
      'Unified academic administration covering admissions, student attendance, fee records, timetables, and parent portals.',
    icon: GraduationCap,
  },
  {
    number: '06',
    title: 'NGO & Government Management Systems',
    description:
      'Transparent beneficiary tracking, field data collection, grant reporting, and compliant digital governance portals.',
    icon: Building2,
  },
  {
    number: '07',
    title: 'Custom ERP Solutions',
    description:
      'Modular enterprise resource planning tailored around your exact procurement, finance, operations, and reporting workflows.',
    icon: Network,
  },
  {
    number: '08',
    title: 'Business Automation Systems',
    description:
      'Eliminate manual spreadsheets and repetitive approvals with rule-based digital workflows and automated notifications.',
    icon: Cpu,
  },
];

const TECHNOLOGY_CATEGORIES = [
  {
    category: 'Java & Backend',
    icon: Server,
    items: ['Java 8', 'Java 17', 'Java 21', 'Spring Boot 3', 'Spring MVC', 'Spring Security', 'Hibernate / JPA', 'REST APIs'],
  },
  {
    category: 'Modern Architecture',
    icon: Network,
    items: ['Microservices', 'API-first systems', 'Event-driven services', 'Redis', 'Apache Kafka'],
  },
  {
    category: 'Frontend',
    icon: Layout,
    items: ['React.js', 'JavaScript', 'HTML5', 'CSS3', 'Bootstrap'],
  },
  {
    category: 'Database',
    icon: Database,
    items: ['MySQL', 'Microsoft SQL Server'],
  },
  {
    category: 'Cloud & DevOps',
    icon: Cloud,
    items: ['AWS', 'Docker', 'Kubernetes', 'GitHub Actions', 'Azure DevOps', 'CI/CD'],
  },
  {
    category: 'Tools',
    icon: Wrench,
    items: ['Git', 'Maven', 'Postman', 'IntelliJ IDEA', 'Eclipse', 'VS Code'],
  },
];

const PROCESS_STEPS = [
  {
    step: '01',
    title: 'Requirement Analysis',
    description:
      'Deep-dive discovery into your business objectives, operational challenges, user roles, and compliance requirements.',
  },
  {
    step: '02',
    title: 'Planning & Architecture',
    description:
      'Designing scalable database schemas, secure API contracts, modular system architecture, and clear delivery milestones.',
  },
  {
    step: '03',
    title: 'UI/UX Design',
    description:
      'Crafting clean, intuitive, and responsive user interfaces focused on usability, accessibility, and brand consistency.',
  },
  {
    step: '04',
    title: 'Development',
    description:
      'Agile full-stack implementation using Java, Spring Boot, React.js, and modern mobile/cloud technologies.',
  },
  {
    step: '05',
    title: 'Testing & Quality Assurance',
    description:
      'Rigorous functional, API, security, and cross-device testing to ensure defect-free, high-performance execution.',
  },
  {
    step: '06',
    title: 'Deployment',
    description:
      'Seamless production rollout on AWS or dedicated servers with SSL configuration, monitoring, and zero-downtime setup.',
  },
  {
    step: '07',
    title: 'Maintenance & Support',
    description:
      'Continuous performance tuning, security updates, version upgrades, and responsive post-launch technical assistance.',
  },
];

const WHY_CHOOSE_ITEMS = [
  {
    title: 'Reliable Solutions',
    description:
      'Dependable application engineering designed to keep mission-critical business operations running smoothly.',
    icon: ShieldCheck,
  },
  {
    title: 'Scalable Architecture',
    description:
      'Modular, API-first system foundations ready to expand smoothly as your users, data, and operations grow.',
    icon: TrendingUp,
  },
  {
    title: 'On-Time Delivery Commitment',
    description:
      'Structured sprint planning, clear milestones, and disciplined execution focused on meeting agreed schedules.',
    icon: Clock,
  },
  {
    title: 'Client-Focused Approach',
    description:
      'Direct technical consulting, transparent communication, and complete transparency from concept to launch.',
    icon: Target,
  },
  {
    title: 'Modern Technology Stack',
    description:
      'Modern enterprise technologies including Java 17 and 21, Spring Boot 3, React.js, and AWS, selected for long-term viability.',
    icon: Layers,
  },
  {
    title: 'Customized Business Solutions',
    description:
      'Software engineered specifically around your exact workflows rather than forcing rigid off-the-shelf limitations.',
    icon: Sliders,
  },
  {
    title: 'Secure Development Practices',
    description:
      'Role-based access control, Spring Security standards, encrypted transport, and validated data handling at every layer.',
    icon: Lock,
  },
  {
    title: 'Cloud Deployment Expertise',
    description:
      'End-to-end setup across AWS EC2, RDS, S3, CI/CD pipelines, and SSL-hardened production environments.',
    icon: Cloud,
  },
];

function buildVCardString() {
  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'N:Routhu;Dharma;;;',
    `FN:${COMPANY_INFO.founder}`,
    `ORG:${COMPANY_INFO.name}`,
    `TITLE:${COMPANY_INFO.designation}`,
    `TEL;TYPE=CELL,VOICE:${COMPANY_INFO.phoneRaw}`,
    `EMAIL;TYPE=PREF,INTERNET:${COMPANY_INFO.email}`,
    `URL:${COMPANY_INFO.linkedin}`,
    `ADR;TYPE=WORK:;;${COMPANY_INFO.location};;;;`,
    `NOTE:${COMPANY_INFO.designation} at ${COMPANY_INFO.name} | LinkedIn: ${COMPANY_INFO.linkedin} | ${COMPANY_INFO.tagline}`,
    'END:VCARD',
  ].join('\n');
}

// ============================================================================
// 3. CUSTOM DN TECH SOLUTIONS VECTOR LOGO (MATCHING VISITING CARD SWOOSH MONOGRAM)
// ============================================================================
const BrandLogo = ({ showTagline = true, size = 'md' }) => {
  const iconHeight = size === 'lg' ? 54 : 42;
  const iconWidth = Math.round(iconHeight * 1.25);

  return (
    <div className="inline-flex items-center gap-3 select-none">
      <svg
        width={iconWidth}
        height={iconHeight}
        viewBox="0 0 110 88"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="dnWhiteMetal" x1="16" y1="14" x2="54" y2="72" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="65%" stopColor="#E6F3FF" />
            <stop offset="100%" stopColor="#94C5FF" />
          </linearGradient>
          <linearGradient id="dnElectricBlue" x1="52" y1="18" x2="96" y2="74" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00E1FF" />
            <stop offset="50%" stopColor="#007BFF" />
            <stop offset="100%" stopColor="#0044CC" />
          </linearGradient>
          <linearGradient id="dnSwoosh" x1="6" y1="68" x2="98" y2="12" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#006BFF" />
            <stop offset="48%" stopColor="#00D4FF" />
            <stop offset="100%" stopColor="#FFFFFF" />
          </linearGradient>
        </defs>

        {/* Orbital Swoosh Arc */}
        <path
          d="M12 63C4 48 16 28 45 16C71 5 94 7 96 20C97 27 89 35 78 41C85 33 88 26 85 21C81 14 61 14 39 23C19 32 10 47 16 58C20 65 33 67 51 64C32 71 17 70 12 63Z"
          fill="url(#dnSwoosh)"
        />

        {/* Stylized 'D' */}
        <path
          d="M22 22H42C55 22 63 30 63 44C63 58 55 66 42 66H22L28 56H41C48.5 56 52.5 51.5 52.5 44C52.5 36.5 48.5 32 41 32H27L22 22Z"
          fill="url(#dnWhiteMetal)"
        />
        <path d="M25 36H35L30 66H20L25 36Z" fill="url(#dnWhiteMetal)" />

        {/* Stylized 'N' */}
        <path
          d="M64 66V24L74 33L88 52V24H98V66L88 57L74 38V66H64Z"
          fill="url(#dnElectricBlue)"
        />
      </svg>

      <div className="flex flex-col">
        <span
          className={`font-extrabold tracking-wider text-white leading-none ${
            size === 'lg' ? 'text-2xl' : 'text-lg'
          }`}
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          DN <span className="text-[#00D4FF]">TECH SOLUTIONS</span>
        </span>
        {showTagline && (
          <span className="text-[10px] sm:text-[11px] font-semibold tracking-[0.18em] text-[#00D4FF] mt-1">
            {COMPANY_INFO.tagline}
          </span>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 4. MAIN APPLICATION COMPONENT
// ============================================================================
export default function App() {
  const [pageView, setPageView] = useState('all');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('#home');
  const [cardSide, setCardSide] = useState('both');
  const [selectedService, setSelectedService] = useState(null);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  });
  const [formSentNotice, setFormSentNotice] = useState(false);

  const vCardPayload = useMemo(() => buildVCardString(), []);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24);
      setShowBackToTop(window.scrollY > 420);

      const pos = window.scrollY + 140;
      for (let i = NAV_ITEMS.length - 1; i >= 0; i--) {
        const el = document.querySelector(NAV_ITEMS[i].href);
        if (el && el.offsetTop <= pos) {
          setActiveSection(NAV_ITEMS[i].href);
          break;
        }
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleNavClick = (href) => {
    setMobileMenuOpen(false);
    if (pageView !== 'all') {
      setPageView('all');
      setTimeout(() => {
        const target = document.querySelector(href);
        if (target) target.scrollIntoView({ behavior: 'smooth' });
      }, 60);
    }
  };

  const handleDownloadVCard = () => {
    const blob = new Blob([vCardPayload], { type: 'text/vcard;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Dharma_Routhu_DN_Tech_Solutions.vcf');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleMailtoSubmit = (e) => {
    e.preventDefault();
    const subjectLine = encodeURIComponent(
      formData.subject.trim() || `Project Inquiry from ${formData.name || 'Website Visitor'}`
    );
    const bodyLines = encodeURIComponent(
      [
        `Name: ${formData.name}`,
        `Email: ${formData.email}`,
        `Phone: ${formData.phone || 'Not provided'}`,
        '',
        'Project Details:',
        formData.message,
      ].join('\n')
    );

    setFormSentNotice(true);
    window.location.href = `mailto:${COMPANY_INFO.email}?subject=${subjectLine}&body=${bodyLines}`;
  };

  const showHomePage = pageView === 'all' || pageView === 'home';
  const showServicesPage = pageView === 'all' || pageView === 'services';
  const showContactPage = pageView === 'all' || pageView === 'contact';

  return (
    <div
      className="min-h-screen bg-[#020B1C] text-white selection:bg-[#00D4FF] selection:text-[#020B1C]"
      style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      {/* Embedded Google Fonts & Custom Glass/Animation Utilities */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap');
        html { scroll-behavior: smooth; scroll-padding-top: 84px; }
        h1, h2, h3, h4 { font-family: 'Plus Jakarta Sans', 'Inter', sans-serif; }
        .dn-grid-bg {
          background-image:
            linear-gradient(to right, rgba(0, 212, 255, 0.045) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0, 212, 255, 0.045) 1px, transparent 1px);
          background-size: 46px 46px;
        }
        .dn-glass {
          background: rgba(7, 26, 53, 0.58);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border: 1px solid rgba(0, 212, 255, 0.16);
          box-shadow: 0 16px 40px -12px rgba(0, 0, 0, 0.65);
          transition: transform 0.28s ease, border-color 0.28s ease, background-color 0.28s ease, box-shadow 0.28s ease;
        }
        .dn-glass:hover {
          transform: translateY(-4px);
          border-color: rgba(0, 212, 255, 0.48);
          background: rgba(11, 36, 72, 0.78);
          box-shadow: 0 20px 44px -12px rgba(0, 107, 255, 0.3);
        }
        .dn-gradient-btn {
          background: linear-gradient(135deg, #006BFF 0%, #00D4FF 100%);
          box-shadow: 0 12px 32px -8px rgba(0, 107, 255, 0.45);
          transition: all 0.25s ease;
        }
        .dn-gradient-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 16px 36px -6px rgba(0, 212, 255, 0.52);
          filter: brightness(1.06);
        }
      `}</style>

      {/* ===================================================================== */}
      {/* 1. STICKY RESPONSIVE NAVIGATION BAR                                   */}
      {/* ===================================================================== */}
      <header
        className={`sticky top-0 z-50 border-b border-[#00D4FF]/15 transition-all duration-300 ${
          scrolled
            ? 'bg-[#020B1C]/95 backdrop-blur-xl shadow-2xl shadow-black/60'
            : 'bg-[#020B1C]/85 backdrop-blur-lg'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          <a
            href="#home"
            onClick={() => handleNavClick('#home')}
            aria-label="DN TECH SOLUTIONS Home"
          >
            <BrandLogo showTagline={true} />
          </a>

          {/* Desktop Links */}
          <nav aria-label="Primary Navigation" className="hidden lg:flex items-center gap-6">
            {NAV_ITEMS.map((item) => {
              const isActive = activeSection === item.href && pageView === 'all';
              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => handleNavClick(item.href)}
                  className={`text-sm font-medium transition-colors py-1 relative ${
                    isActive ? 'text-white' : 'text-[#B8C7DA] hover:text-white'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute left-0 right-0 -bottom-1 h-0.5 rounded-full bg-gradient-to-r from-[#006BFF] to-[#00D4FF]" />
                  )}
                </a>
              );
            })}
          </nav>

          {/* Desktop CTA & Mobile Hamburger */}
          <div className="flex items-center gap-3">
            <a
              href="#contact"
              onClick={() => handleNavClick('#contact')}
              className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white dn-gradient-btn"
            >
              Let&apos;s Talk
              <ArrowUpRight className="w-4 h-4" />
            </a>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
              className="lg:hidden p-2.5 rounded-xl bg-[#071A35] border border-[#00D4FF]/25 text-white hover:border-[#00D4FF]"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#041229]/98 backdrop-blur-xl border-b border-[#00D4FF]/25 px-4 pt-3 pb-6 space-y-2">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => handleNavClick(item.href)}
                className="block px-4 py-3 rounded-xl text-sm font-medium text-[#B8C7DA] hover:text-white bg-[#071A35]/60 border border-transparent hover:border-[#00D4FF]/25"
              >
                {item.label}
              </a>
            ))}
            <a
              href="#contact"
              onClick={() => handleNavClick('#contact')}
              className="mt-2 w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white dn-gradient-btn"
            >
              Let&apos;s Talk
              <ArrowUpRight className="w-4 h-4" />
            </a>
          </div>
        )}
      </header>

      {/* ===================================================================== */}
      {/* 2. STATIC MULTI-PAGE / VIEW SWITCHER BAR                              */}
      {/* ===================================================================== */}
      <div className="bg-[#071A35]/75 border-b border-[#00D4FF]/15 py-2.5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#B8C7DA]">
            <span className="inline-block w-2 h-2 rounded-full bg-[#00D4FF] animate-pulse" />
            <span>Static Pages View:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {PAGE_VIEWS.map((view) => (
              <button
                key={view.id}
                type="button"
                onClick={() => {
                  setPageView(view.id);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`btn btn-sm px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  pageView === view.id
                    ? 'dn-gradient-btn text-white'
                    : 'bg-[#020B1C]/75 text-[#B8C7DA] border border-[#00D4FF]/20 hover:border-[#00D4FF]/50 hover:text-white'
                }`}
              >
                {view.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main>
        {/* =================================================================== */}
        {/* 3. HERO SECTION                                                     */}
        {/* =================================================================== */}
        {showHomePage && (
          <section id="home" className="relative overflow-hidden dn-grid-bg py-16 sm:py-24">
            {/* Ambient Glow Orbs */}
            <div
              className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full blur-3xl opacity-30"
              style={{ background: '#006BFF' }}
            />
            <div
              className="pointer-events-none absolute -bottom-24 -right-24 w-96 h-96 rounded-full blur-3xl opacity-25"
              style={{ background: '#00D4FF' }}
            />

            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-12 gap-12 items-center">
              {/* Left Column */}
              <div className="lg:col-span-7">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#00D4FF]/10 border border-[#00D4FF]/30 text-[#00D4FF] text-xs font-bold tracking-[0.14em] mb-6">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{COMPANY_INFO.tagline}</span>
                </div>

                <h1 className="text-3xl sm:text-5xl lg:text-[3.25rem] font-extrabold leading-[1.15] tracking-tight mb-6">
                  Transforming Ideas Into{' '}
                  <span className="bg-gradient-to-r from-[#006BFF] via-[#00A8FF] to-[#00D4FF] bg-clip-text text-transparent">
                    Powerful Digital Solutions
                  </span>
                </h1>

                <p className="text-base sm:text-lg text-[#B8C7DA] leading-relaxed max-w-2xl mb-8">
                  We build intelligent software solutions, custom web applications, mobile
                  applications, QR-based platforms, and scalable enterprise systems that
                  help businesses grow.
                </p>

                <div className="flex flex-wrap gap-4 mb-10">
                  <a
                    href="#services"
                    onClick={() => handleNavClick('#services')}
                    className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl font-semibold text-sm sm:text-base text-white dn-gradient-btn"
                  >
                    Explore Our Services
                    <ArrowRight className="w-4 h-4" />
                  </a>
                  <a
                    href="#contact"
                    onClick={() => handleNavClick('#contact')}
                    className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl font-semibold text-sm sm:text-base text-white bg-[#071A35]/80 border border-[#00D4FF]/35 hover:bg-[#006BFF]/20 hover:border-[#00D4FF] transition-all"
                  >
                    <MessageSquare className="w-4 h-4 text-[#00D4FF]" />
                    Contact Us
                  </a>
                </div>

                {/* 4 Key Highlights */}
                <div className="grid sm:grid-cols-2 gap-3.5">
                  {HERO_HIGHLIGHTS.map((item) => {
                    const IconComp = item.icon;
                    return (
                      <div
                        key={item.title}
                        className="flex items-center gap-3 p-3.5 rounded-xl bg-[#071A35]/65 border border-[#00D4FF]/18"
                      >
                        <div className="w-9 h-9 rounded-lg bg-[#006BFF]/25 text-[#00D4FF] flex items-center justify-center shrink-0">
                          <IconComp className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-semibold text-[#E8F3FF]">
                          {item.title}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Enterprise Architecture Visual Card */}
              <div className="lg:col-span-5">
                <div className="rounded-2xl p-6 sm:p-7 bg-gradient-to-br from-[#071A35]/90 to-[#020B1C]/95 border border-[#00D4FF]/30 shadow-2xl shadow-[#006BFF]/25">
                  <div className="flex items-center justify-between pb-4 mb-5 border-b border-[#00D4FF]/15">
                    <div className="flex items-center gap-2" aria-hidden="true">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]" />
                      <span className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
                      <span className="w-2.5 h-2.5 rounded-full bg-[#27C93F]" />
                    </div>
                    <span className="text-xs font-bold tracking-wider text-[#00D4FF]">
                      DN-SYSTEMS // ENTERPRISE STACK
                    </span>
                  </div>

                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-[#020B1C]/75 border border-[#00D4FF]/20">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#006BFF]/25 text-[#00D4FF] flex items-center justify-center shrink-0">
                          <QrCode className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white">
                            QR Intelligence &amp; Anti-Fraud
                          </div>
                          <div className="text-xs text-[#B8C7DA]">
                            Generation, Validation &amp; Real-Time Tracking
                          </div>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#00D4FF]/15 text-[#00D4FF]">
                        Verified
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-[#020B1C]/75 border border-[#00D4FF]/20">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#006BFF]/25 text-[#00D4FF] flex items-center justify-center shrink-0">
                          <Server className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white">
                            Java 17 / 21 &amp; Spring Boot 3
                          </div>
                          <div className="text-xs text-[#B8C7DA]">
                            REST APIs, Spring Security &amp; Hibernate
                          </div>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#00D4FF]/15 text-[#00D4FF]">
                        Scalable
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-[#020B1C]/75 border border-[#00D4FF]/20">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#006BFF]/25 text-[#00D4FF] flex items-center justify-center shrink-0">
                          <Smartphone className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white">
                            React Web &amp; Mobile Apps
                          </div>
                          <div className="text-xs text-[#B8C7DA]">
                            Android, iOS &amp; Management Dashboards
                          </div>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#00D4FF]/15 text-[#00D4FF]">
                        Responsive
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-[#020B1C]/75 border border-[#00D4FF]/20">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#006BFF]/25 text-[#00D4FF] flex items-center justify-center shrink-0">
                          <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white">
                            AWS Cloud &amp; DevOps CI/CD
                          </div>
                          <div className="text-xs text-[#B8C7DA]">
                            EC2, S3, RDS, GitHub Actions &amp; SSL
                          </div>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#00D4FF]/15 text-[#00D4FF]">
                        Secured
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* =================================================================== */}
        {/* 4. ABOUT DN TECH SOLUTIONS                                               */}
        {/* =================================================================== */}
        {showHomePage && (
          <section
            id="about"
            className="py-20 sm:py-24 bg-[#071A35]/30 border-y border-[#00D4FF]/10"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-12 gap-12 items-center">
              <div className="lg:col-span-6">
                <span className="inline-block px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#006BFF]/20 border border-[#00D4FF]/30 text-[#00D4FF] mb-4">
                  Who We Are
                </span>
                <h2 className="text-3xl sm:text-4xl font-extrabold mb-5">
                  About{' '}
                  <span className="bg-gradient-to-r from-[#006BFF] to-[#00D4FF] bg-clip-text text-transparent">
                    DN TECH SOLUTIONS
                  </span>
                </h2>
                <p className="text-[#B8C7DA] text-base leading-relaxed mb-4">
                  DN TECH SOLUTIONS is a technology-focused software development service provider
                  delivering innovative, reliable, and scalable digital solutions. We help
                  businesses, government organizations, NGOs, startups, and enterprises
                  transform their ideas into practical software applications.
                </p>
                <p className="text-[#B8C7DA] text-base leading-relaxed mb-7">
                  Our focus is on quality development, modern technologies, secure
                  architecture, and customer satisfaction.
                </p>

                {/* Founder Card Strip */}
                <div className="p-4 sm:p-5 rounded-2xl bg-[#071A35]/80 border border-[#00D4FF]/25 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#006BFF]/30 to-[#00D4FF]/20 border border-[#00D4FF]/35 flex items-center justify-center text-[#00D4FF]">
                      <UserCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="font-bold text-white text-base">
                        {COMPANY_INFO.founder}
                      </div>
                      <div className="text-xs sm:text-sm font-medium text-[#00D4FF]">
                        {COMPANY_INFO.designation}
                      </div>
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-2 text-xs sm:text-sm text-[#B8C7DA]">
                    <MapPin className="w-4 h-4 text-[#00D4FF]" />
                    <span>{COMPANY_INFO.location}</span>
                  </div>
                </div>
              </div>

              {/* 4 Pillars Grid */}
              <div className="lg:col-span-6 grid sm:grid-cols-2 gap-5">
                {ABOUT_PILLARS.map((pillar) => {
                  const IconComp = pillar.icon;
                  return (
                    <div key={pillar.title} className="dn-glass rounded-2xl p-6">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#006BFF]/25 to-[#00D4FF]/20 border border-[#00D4FF]/30 text-[#00D4FF] flex items-center justify-center mb-4">
                        <IconComp className="w-5 h-5" />
                      </div>
                      <h3 className="text-lg font-bold text-white mb-2">{pillar.title}</h3>
                      <p className="text-sm text-[#B8C7DA] leading-relaxed">
                        {pillar.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* =================================================================== */}
        {/* 5. INTERACTIVE VISITING CARD & SCANNABLE VCARD QR SHOWCASE          */}
        {/* =================================================================== */}
        {showHomePage && (
          <section id="visiting-card" className="py-20 sm:py-24">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center max-w-2xl mx-auto mb-10">
                <span className="inline-block px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#006BFF]/20 border border-[#00D4FF]/30 text-[#00D4FF] mb-3">
                  Digital Visiting Card &amp; vCard QR
                </span>
                <h2 className="text-3xl sm:text-4xl font-extrabold mb-3">
                  Scan to Save{' '}
                  <span className="bg-gradient-to-r from-[#006BFF] to-[#00D4FF] bg-clip-text text-transparent">
                    Professional Contact
                  </span>
                </h2>
                <p className="text-sm sm:text-base text-[#B8C7DA]">
                  Point your smartphone camera at the QR code below to instantly load Dharma
                  Routhu&apos;s professional details—Name, Designation, Company, Mobile,
                  Email, and LinkedIn profile—directly into your phone contacts.
                </p>
              </div>

              {/* Card Side Switcher */}
              <div className="flex flex-wrap justify-center gap-2.5 mb-8">
                <button
                  type="button"
                  onClick={() => setCardSide('front')}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                    cardSide === 'front'
                      ? 'dn-gradient-btn text-white'
                      : 'bg-[#071A35] text-[#B8C7DA] border border-[#00D4FF]/25 hover:text-white'
                  }`}
                >
                  <FlipHorizontal className="w-4 h-4" />
                  Front Side (Contact &amp; QR)
                </button>
                <button
                  type="button"
                  onClick={() => setCardSide('back')}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                    cardSide === 'back'
                      ? 'dn-gradient-btn text-white'
                      : 'bg-[#071A35] text-[#B8C7DA] border border-[#00D4FF]/25 hover:text-white'
                  }`}
                >
                  <FlipHorizontal className="w-4 h-4" />
                  Back Side (Our Services)
                </button>
                <button
                  type="button"
                  onClick={() => setCardSide('both')}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                    cardSide === 'both'
                      ? 'dn-gradient-btn text-white'
                      : 'bg-[#071A35] text-[#B8C7DA] border border-[#00D4FF]/25 hover:text-white'
                  }`}
                >
                  Show Both Sides
                </button>
              </div>

              {/* Cards Container */}
              <div
                className={`grid gap-7 ${
                  cardSide === 'both' ? 'lg:grid-cols-2' : 'max-w-3xl mx-auto'
                }`}
              >
                {/* FRONT OF VISITING CARD */}
                {(cardSide === 'front' || cardSide === 'both') && (
                  <div
                    className="rounded-3xl p-6 sm:p-8 border border-[#00D4FF]/35 shadow-2xl shadow-[#006BFF]/25 relative overflow-hidden"
                    style={{
                      background:
                        'linear-gradient(125deg, #020B1C 0%, #071E42 52%, #0A2E63 100%)',
                    }}
                  >
                    <div className="grid sm:grid-cols-12 gap-6 items-center">
                      <div className="sm:col-span-7">
                        <BrandLogo showTagline={true} />

                        <div className="mt-6 pl-3.5 border-l-[3px] border-[#00D4FF]">
                          <h3 className="text-2xl font-extrabold text-white">
                            {COMPANY_INFO.founder}
                          </h3>
                          <p className="text-sm font-semibold text-[#00D4FF] mt-0.5">
                            {COMPANY_INFO.designation}
                          </p>
                        </div>

                        <div className="mt-5 space-y-2.5 text-sm">
                          <a
                            href={`tel:${COMPANY_INFO.phoneRaw}`}
                            className="flex items-center gap-2.5 text-white hover:text-[#00D4FF] transition-colors"
                          >
                            <Phone className="w-4 h-4 text-[#00D4FF] shrink-0" />
                            <span>{COMPANY_INFO.phoneDisplay}</span>
                          </a>

                          <a
                            href={`mailto:${COMPANY_INFO.email}`}
                            className="flex items-center gap-2.5 text-white hover:text-[#00D4FF] transition-colors break-all"
                          >
                            <Mail className="w-4 h-4 text-[#00D4FF] shrink-0" />
                            <span>{COMPANY_INFO.email}</span>
                          </a>

                          <a
                            href={COMPANY_INFO.linkedin}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2.5 text-[#00D4FF] hover:underline break-all"
                          >
                            <Linkedin className="w-4 h-4 text-[#00D4FF] shrink-0" />
                            <span>linkedin.com/in/dharmarouthu009</span>
                          </a>

                          <div className="flex items-center gap-2.5 text-[#B8C7DA]">
                            <MapPin className="w-4 h-4 text-[#00D4FF] shrink-0" />
                            <span>{COMPANY_INFO.location}</span>
                          </div>
                        </div>
                      </div>

                      {/* Real Scannable QR Box */}
                      <div className="sm:col-span-5 flex flex-col items-center text-center p-4 rounded-2xl bg-[#020B1C]/80 border border-[#00D4FF]/30">
                        <div className="p-2.5 bg-white rounded-xl shadow-lg mb-3">
                          <ScannableQRCode value={vCardPayload} size={144} />
                        </div>
                        <div className="text-xs font-bold text-white">
                          Scan to Save Contact
                        </div>
                        <div className="text-[11px] text-[#B8C7DA] mt-1 mb-3">
                          vCard 3.0 &bull; Phone, Email &amp; LinkedIn
                        </div>
                        <button
                          type="button"
                          onClick={handleDownloadVCard}
                          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white dn-gradient-btn"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download .VCF
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* BACK OF VISITING CARD */}
                {(cardSide === 'back' || cardSide === 'both') && (
                  <div
                    className="rounded-3xl p-6 sm:p-8 border border-[#00D4FF]/35 shadow-2xl shadow-[#006BFF]/25 flex flex-col justify-between"
                    style={{
                      background:
                        'linear-gradient(135deg, #020B1C 0%, #071A35 55%, #06254E 100%)',
                    }}
                  >
                    <div>
                      <div className="inline-block px-3.5 py-1 rounded-lg bg-gradient-to-r from-[#006BFF] to-[#00D4FF] text-[#020B1C] font-extrabold text-xs uppercase tracking-wider mb-5">
                        Our Services
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-lg bg-[#006BFF]/25 border border-[#00D4FF]/30 text-[#00D4FF] flex items-center justify-center shrink-0">
                            <QrCode className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-white">
                              QR Code Based Applications
                            </div>
                            <div className="text-xs text-[#B8C7DA] mt-0.5">
                              QR Generation | Validation | Tracking | Fraud Detection
                            </div>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-lg bg-[#006BFF]/25 border border-[#00D4FF]/30 text-[#00D4FF] flex items-center justify-center shrink-0">
                            <Globe className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-white">
                              Web Application Development
                            </div>
                            <div className="text-xs text-[#B8C7DA] mt-0.5">
                              Enterprise &amp; Custom Business Applications
                            </div>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-lg bg-[#006BFF]/25 border border-[#00D4FF]/30 text-[#00D4FF] flex items-center justify-center shrink-0">
                            <Smartphone className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-white">
                              Mobile App Development
                            </div>
                            <div className="text-xs text-[#B8C7DA] mt-0.5">
                              Android &amp; iOS (Native / Hybrid)
                            </div>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-lg bg-[#006BFF]/25 border border-[#00D4FF]/30 text-[#00D4FF] flex items-center justify-center shrink-0">
                            <Cloud className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-white">
                              Deployment &amp; Cloud Solutions
                            </div>
                            <div className="text-xs text-[#B8C7DA] mt-0.5">
                              AWS (EC2, S3, RDS) | CI/CD | DevOps | Hosting
                            </div>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-lg bg-[#006BFF]/25 border border-[#00D4FF]/30 text-[#00D4FF] flex items-center justify-center shrink-0">
                            <Server className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-white">
                              Java Application Development
                            </div>
                            <div className="text-xs text-[#B8C7DA] mt-0.5">
                              Java 17 / 21 | Spring Boot 3 | Spring Security | Hibernate | REST APIs
                            </div>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-lg bg-[#006BFF]/25 border border-[#00D4FF]/30 text-[#00D4FF] flex items-center justify-center shrink-0">
                            <Wrench className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-white">
                              Application Support &amp; Maintenance
                            </div>
                            <div className="text-xs text-[#B8C7DA] mt-0.5">
                              Enhancements | Bug Fixes | Upgrades | Security
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5 mt-6 border-t border-[#00D4FF]/20 text-xs font-semibold text-white">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-[#00D4FF] shrink-0" />
                        <span>Reliable Solutions</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Lock className="w-4 h-4 text-[#00D4FF] shrink-0" />
                        <span>Scalable &amp; Secure</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-[#00D4FF] shrink-0" />
                        <span>On-Time Delivery</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Target className="w-4 h-4 text-[#00D4FF] shrink-0" />
                        <span>Client-Focused</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* =================================================================== */}
        {/* 6. OUR SERVICES (ALL 6 CATEGORIES A-F + DETAIL MODAL)               */}
        {/* =================================================================== */}
        {showServicesPage && (
          <section
            id="services"
            className="py-20 sm:py-24 bg-[#071A35]/25 border-t border-[#00D4FF]/10"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center max-w-2xl mx-auto mb-14">
                <span className="inline-block px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#006BFF]/20 border border-[#00D4FF]/30 text-[#00D4FF] mb-3">
                  What We Deliver
                </span>
                <h2 className="text-3xl sm:text-4xl font-extrabold mb-3">
                  Comprehensive{' '}
                  <span className="bg-gradient-to-r from-[#006BFF] to-[#00D4FF] bg-clip-text text-transparent">
                    Software &amp; Digital Services
                  </span>
                </h2>
                <p className="text-sm sm:text-base text-[#B8C7DA]">
                  End-to-end engineering across QR code ecosystems, custom enterprise web
                  portals, Java Spring Boot backends, mobile apps, and AWS cloud
                  infrastructure.
                </p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {SERVICES_DATA.map((service) => {
                  const IconComp = service.icon;
                  return (
                    <article
                      key={service.id}
                      className="dn-glass rounded-2xl p-6 sm:p-7 flex flex-col h-full"
                    >
                      <div className="flex items-start justify-between mb-5">
                        <div className="w-12 h-12 rounded-2xl dn-gradient-btn flex items-center justify-center text-white">
                          <IconComp className="w-6 h-6" />
                        </div>
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#00D4FF]/10 border border-[#00D4FF]/25 text-[#00D4FF]">
                          Service {service.code}
                        </span>
                      </div>

                      <h3 className="text-xl font-bold text-white mb-2.5">{service.title}</h3>
                      <p className="text-sm text-[#B8C7DA] mb-5 leading-relaxed">
                        {service.shortDescription}
                      </p>

                      <ul className="space-y-2 mb-6 flex-grow">
                        {service.items.map((item) => (
                          <li
                            key={item}
                            className="flex items-start gap-2.5 text-sm text-[#DCE8F8]"
                          >
                            <CheckCircle2 className="w-4 h-4 text-[#00D4FF] shrink-0 mt-0.5" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>

                      <button
                        type="button"
                        onClick={() => setSelectedService(service)}
                        className="inline-flex items-center gap-2 pt-4 border-t border-[#00D4FF]/15 text-sm font-semibold text-[#00D4FF] hover:text-white transition-colors"
                      >
                        Learn More
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* =================================================================== */}
        {/* 7. SPECIALIZED SOLUTIONS                                            */}
        {/* =================================================================== */}
        {showServicesPage && (
          <section className="py-20 sm:py-24 bg-[#071A35]/40 border-y border-[#00D4FF]/10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center max-w-2xl mx-auto mb-14">
                <span className="inline-block px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#006BFF]/20 border border-[#00D4FF]/30 text-[#00D4FF] mb-3">
                  Specialized Platforms
                </span>
                <h2 className="text-3xl sm:text-4xl font-extrabold mb-3">
                  Smart Digital Solutions{' '}
                  <span className="bg-gradient-to-r from-[#006BFF] to-[#00D4FF] bg-clip-text text-transparent">
                    For Every Business
                  </span>
                </h2>
                <p className="text-sm sm:text-base text-[#B8C7DA]">
                  Purpose-built software platforms engineered to automate operations,
                  prevent counterfeiting, and bring real-time visibility across
                  organizations.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {SPECIALIZED_SOLUTIONS.map((sol) => {
                  const IconComp = sol.icon;
                  return (
                    <div key={sol.number} className="dn-glass rounded-2xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-11 h-11 rounded-xl bg-[#006BFF]/20 border border-[#00D4FF]/30 text-[#00D4FF] flex items-center justify-center">
                          <IconComp className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-extrabold text-[#00D4FF]">
                          #{sol.number}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-white mb-2">{sol.title}</h3>
                      <p className="text-sm text-[#B8C7DA] leading-relaxed">
                        {sol.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* =================================================================== */}
        {/* 8. TECHNOLOGIES WE WORK WITH                                        */}
        {/* =================================================================== */}
        {showServicesPage && (
          <section id="technologies" className="py-20 sm:py-24">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center max-w-2xl mx-auto mb-14">
                <span className="inline-block px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#006BFF]/20 border border-[#00D4FF]/30 text-[#00D4FF] mb-3">
                  Technology Stack
                </span>
                <h2 className="text-3xl sm:text-4xl font-extrabold mb-3">
                  Technologies{' '}
                  <span className="bg-gradient-to-r from-[#006BFF] to-[#00D4FF] bg-clip-text text-transparent">
                    We Work With
                  </span>
                </h2>
                <p className="text-sm sm:text-base text-[#B8C7DA]">
                  Battle-tested enterprise frameworks, modern frontend libraries,
                  relational databases, and cloud automation tools.
                </p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {TECHNOLOGY_CATEGORIES.map((group) => {
                  const IconComp = group.icon;
                  return (
                    <div key={group.category} className="dn-glass rounded-2xl p-6">
                      <div className="flex items-center gap-3 pb-4 mb-4 border-b border-[#00D4FF]/15">
                        <div className="w-9 h-9 rounded-lg bg-[#006BFF]/25 text-[#00D4FF] flex items-center justify-center">
                          <IconComp className="w-4 h-4" />
                        </div>
                        <h3 className="text-lg font-bold text-white">{group.category}</h3>
                      </div>

                      <div className="flex flex-wrap gap-2.5">
                        {group.items.map((tech) => (
                          <span
                            key={tech}
                            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#020B1C]/80 border border-[#00D4FF]/20 text-xs sm:text-sm font-semibold text-[#E8F3FF] hover:border-[#00D4FF] hover:bg-[#006BFF]/20 transition-all"
                          >
                            <span className="w-2 h-2 rounded-full bg-[#00D4FF]" />
                            {tech}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* =================================================================== */}
        {/* 9. OUR DEVELOPMENT PROCESS (7 STEPS)                                */}
        {/* =================================================================== */}
        {showServicesPage && (
          <section
            id="process"
            className="py-20 sm:py-24 bg-[#071A35]/35 border-y border-[#00D4FF]/10"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center max-w-2xl mx-auto mb-14">
                <span className="inline-block px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#006BFF]/20 border border-[#00D4FF]/30 text-[#00D4FF] mb-3">
                  How We Build
                </span>
                <h2 className="text-3xl sm:text-4xl font-extrabold mb-3">
                  Our{' '}
                  <span className="bg-gradient-to-r from-[#006BFF] to-[#00D4FF] bg-clip-text text-transparent">
                    Development Process
                  </span>
                </h2>
                <p className="text-sm sm:text-base text-[#B8C7DA]">
                  A structured, transparent seven-stage engineering lifecycle that turns
                  complex requirements into reliable production software.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {PROCESS_STEPS.map((item) => (
                  <div key={item.step} className="dn-glass rounded-2xl p-6">
                    <div className="w-10 h-10 rounded-xl dn-gradient-btn flex items-center justify-center font-extrabold text-sm text-white mb-4">
                      {item.step}
                    </div>
                    <h3 className="text-base font-bold text-white mb-2">{item.title}</h3>
                    <p className="text-sm text-[#B8C7DA] leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* =================================================================== */}
        {/* 10. WHY CHOOSE DN TECH SOLUTIONS                                         */}
        {/* =================================================================== */}
        {showServicesPage && (
          <section className="py-20 sm:py-24">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center max-w-2xl mx-auto mb-14">
                <span className="inline-block px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#006BFF]/20 border border-[#00D4FF]/30 text-[#00D4FF] mb-3">
                  Our Commitment
                </span>
                <h2 className="text-3xl sm:text-4xl font-extrabold mb-3">
                  Why Choose{' '}
                  <span className="bg-gradient-to-r from-[#006BFF] to-[#00D4FF] bg-clip-text text-transparent">
                    DN TECH SOLUTIONS?
                  </span>
                </h2>
                <p className="text-sm sm:text-base text-[#B8C7DA]">
                  Practical technical consulting, clean engineering standards, and direct
                  accountability on every project we deliver.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {WHY_CHOOSE_ITEMS.map((item) => {
                  const IconComp = item.icon;
                  return (
                    <div key={item.title} className="dn-glass rounded-2xl p-6">
                      <div className="w-11 h-11 rounded-xl bg-[#006BFF]/20 border border-[#00D4FF]/30 text-[#00D4FF] flex items-center justify-center mb-4">
                        <IconComp className="w-5 h-5" />
                      </div>
                      <h3 className="text-base font-bold text-white mb-2">{item.title}</h3>
                      <p className="text-sm text-[#B8C7DA] leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* =================================================================== */}
        {/* 11. CONTACT SECTION                                                 */}
        {/* =================================================================== */}
        {showContactPage && (
          <section
            id="contact"
            className="py-20 sm:py-24 bg-[#071A35]/35 border-t border-[#00D4FF]/10"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center max-w-2xl mx-auto mb-14">
                <span className="inline-block px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#006BFF]/20 border border-[#00D4FF]/30 text-[#00D4FF] mb-3">
                  Get In Touch
                </span>
                <h2 className="text-3xl sm:text-4xl font-extrabold mb-3">
                  Have a Project{' '}
                  <span className="bg-gradient-to-r from-[#006BFF] to-[#00D4FF] bg-clip-text text-transparent">
                    in Mind?
                  </span>
                </h2>
                <p className="text-sm sm:text-base text-[#B8C7DA]">
                  Let&apos;s discuss your ideas and turn them into powerful digital
                  solutions.
                </p>
              </div>

              <div className="grid lg:grid-cols-12 gap-8 items-start">
                {/* Left Column: Direct Details, WhatsApp, LinkedIn & Scannable vCard QR */}
                <div className="lg:col-span-5 dn-glass rounded-2xl p-6 sm:p-8">
                  <h3 className="text-xl font-bold text-white mb-1.5">
                    Contact Information
                  </h3>
                  <p className="text-sm text-[#B8C7DA] mb-6">
                    Reach out directly via phone, email, LinkedIn, or WhatsApp for
                    consultations and project discussions.
                  </p>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-[#020B1C]/70 border border-[#00D4FF]/15">
                      <div className="w-10 h-10 rounded-xl bg-[#006BFF]/20 text-[#00D4FF] flex items-center justify-center shrink-0">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs text-[#7F95B2]">Name</div>
                        <div className="text-sm font-semibold text-white">
                          {COMPANY_INFO.founder}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-[#020B1C]/70 border border-[#00D4FF]/15">
                      <div className="w-10 h-10 rounded-xl bg-[#006BFF]/20 text-[#00D4FF] flex items-center justify-center shrink-0">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs text-[#7F95B2]">Company</div>
                        <div className="text-sm font-semibold text-white">
                          {COMPANY_INFO.name}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-[#020B1C]/70 border border-[#00D4FF]/15">
                      <div className="w-10 h-10 rounded-xl bg-[#006BFF]/20 text-[#00D4FF] flex items-center justify-center shrink-0">
                        <Briefcase className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs text-[#7F95B2]">Designation</div>
                        <div className="text-sm font-semibold text-white">
                          {COMPANY_INFO.designation}
                        </div>
                      </div>
                    </div>

                    <a
                      href={`tel:${COMPANY_INFO.phoneRaw}`}
                      className="flex items-center gap-3.5 p-3.5 rounded-xl bg-[#020B1C]/70 border border-[#00D4FF]/15 hover:border-[#00D4FF] transition-colors"
                    >
                      <div className="w-10 h-10 rounded-xl bg-[#006BFF]/20 text-[#00D4FF] flex items-center justify-center shrink-0">
                        <Phone className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs text-[#7F95B2]">Mobile (Click to Call)</div>
                        <div className="text-sm font-semibold text-[#00D4FF]">
                          {COMPANY_INFO.phoneDisplay}
                        </div>
                      </div>
                    </a>

                    <a
                      href={`mailto:${COMPANY_INFO.email}`}
                      className="flex items-center gap-3.5 p-3.5 rounded-xl bg-[#020B1C]/70 border border-[#00D4FF]/15 hover:border-[#00D4FF] transition-colors"
                    >
                      <div className="w-10 h-10 rounded-xl bg-[#006BFF]/20 text-[#00D4FF] flex items-center justify-center shrink-0">
                        <Mail className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs text-[#7F95B2]">Email (Click to Mail)</div>
                        <div className="text-sm font-semibold text-[#00D4FF] break-all">
                          {COMPANY_INFO.email}
                        </div>
                      </div>
                    </a>

                    <a
                      href={COMPANY_INFO.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3.5 p-3.5 rounded-xl bg-[#020B1C]/70 border border-[#00D4FF]/15 hover:border-[#00D4FF] transition-colors"
                    >
                      <div className="w-10 h-10 rounded-xl bg-[#006BFF]/20 text-[#00D4FF] flex items-center justify-center shrink-0">
                        <Linkedin className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs text-[#7F95B2]">LinkedIn Profile</div>
                        <div className="text-sm font-semibold text-[#00D4FF] break-all">
                          {COMPANY_INFO.linkedin}
                        </div>
                      </div>
                    </a>

                    <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-[#020B1C]/70 border border-[#00D4FF]/15">
                      <div className="w-10 h-10 rounded-xl bg-[#006BFF]/20 text-[#00D4FF] flex items-center justify-center shrink-0">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs text-[#7F95B2]">Location</div>
                        <div className="text-sm font-semibold text-white">
                          {COMPANY_INFO.location}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-3 mb-6">
                    <a
                      href={`https://wa.me/${COMPANY_INFO.whatsappNumber}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/30 transition-all"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Chat on WhatsApp
                    </a>
                    <a
                      href={COMPANY_INFO.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white bg-[#020B1C] border border-[#00D4FF]/30 hover:border-[#00D4FF] transition-all"
                    >
                      <Linkedin className="w-4 h-4 text-[#00D4FF]" />
                      LinkedIn
                    </a>
                  </div>

                  {/* Scannable vCard QR */}
                  <div className="p-4 rounded-2xl bg-[#020B1C]/85 border border-[#00D4FF]/25 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                    <div className="p-2 bg-white rounded-xl shrink-0">
                      <ScannableQRCode value={vCardPayload} size={108} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white mb-1">
                        Scan for Professional vCard
                      </div>
                      <p className="text-xs text-[#B8C7DA] leading-relaxed mb-2.5">
                        Scan with your camera to save <strong>{COMPANY_INFO.founder}</strong>{' '}
                        ({COMPANY_INFO.name}) with mobile, email, and LinkedIn.
                      </p>
                      <button
                        type="button"
                        onClick={handleDownloadVCard}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#00D4FF] hover:underline"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download .VCF File
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Column: Static Mailto Inquiry Form */}
                <div className="lg:col-span-7 dn-glass rounded-2xl p-6 sm:p-8">
                  <h3 className="text-xl font-bold text-white mb-1.5">
                    Send Project Inquiry
                  </h3>
                  <p className="text-sm text-[#B8C7DA] mb-6">
                    Fill in your project requirements below to compose a pre-filled email
                    directly to DN TECH SOLUTIONS.
                  </p>

                  <form onSubmit={handleMailtoSubmit} className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="contact-name"
                          className="block text-xs font-semibold text-[#DCE9F8] mb-1.5"
                        >
                          Your Name *
                        </label>
                        <input
                          id="contact-name"
                          name="name"
                          type="text"
                          required
                          placeholder="Enter your full name"
                          value={formData.name}
                          onChange={handleFormChange}
                          className="w-full px-4 py-3 rounded-xl bg-[#020B1C]/85 border border-[#00D4FF]/25 text-sm text-white placeholder-[#6D84A3] focus:outline-none focus:border-[#00D4FF]"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="contact-email"
                          className="block text-xs font-semibold text-[#DCE9F8] mb-1.5"
                        >
                          Email Address *
                        </label>
                        <input
                          id="contact-email"
                          name="email"
                          type="email"
                          required
                          placeholder="you@company.com"
                          value={formData.email}
                          onChange={handleFormChange}
                          className="w-full px-4 py-3 rounded-xl bg-[#020B1C]/85 border border-[#00D4FF]/25 text-sm text-white placeholder-[#6D84A3] focus:outline-none focus:border-[#00D4FF]"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="contact-phone"
                          className="block text-xs font-semibold text-[#DCE9F8] mb-1.5"
                        >
                          Phone Number
                        </label>
                        <input
                          id="contact-phone"
                          name="phone"
                          type="tel"
                          placeholder="+91 XXXXX XXXXX"
                          value={formData.phone}
                          onChange={handleFormChange}
                          className="w-full px-4 py-3 rounded-xl bg-[#020B1C]/85 border border-[#00D4FF]/25 text-sm text-white placeholder-[#6D84A3] focus:outline-none focus:border-[#00D4FF]"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="contact-subject"
                          className="block text-xs font-semibold text-[#DCE9F8] mb-1.5"
                        >
                          Subject *
                        </label>
                        <input
                          id="contact-subject"
                          name="subject"
                          type="text"
                          required
                          placeholder="e.g., QR Tracking System / Java Web App"
                          value={formData.subject}
                          onChange={handleFormChange}
                          className="w-full px-4 py-3 rounded-xl bg-[#020B1C]/85 border border-[#00D4FF]/25 text-sm text-white placeholder-[#6D84A3] focus:outline-none focus:border-[#00D4FF]"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="contact-message"
                        className="block text-xs font-semibold text-[#DCE9F8] mb-1.5"
                      >
                        Project Message *
                      </label>
                      <textarea
                        id="contact-message"
                        name="message"
                        rows={5}
                        required
                        placeholder="Describe your project goals, timeline, and key features..."
                        value={formData.message}
                        onChange={handleFormChange}
                        className="w-full px-4 py-3 rounded-xl bg-[#020B1C]/85 border border-[#00D4FF]/25 text-sm text-white placeholder-[#6D84A3] focus:outline-none focus:border-[#00D4FF] resize-y"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold text-white dn-gradient-btn"
                    >
                      <Send className="w-4 h-4" />
                      Open Email App &amp; Send Inquiry
                    </button>

                    {formSentNotice && (
                      <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-400/40 text-xs text-emerald-200 flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span>
                          Your email client has been triggered with your pre-filled inquiry
                          to <strong>{COMPANY_INFO.email}</strong>.
                        </span>
                      </div>
                    )}

                    <div className="p-3.5 rounded-xl bg-[#00D4FF]/10 border border-[#00D4FF]/20 text-xs text-[#B8C7DA] flex items-start gap-2.5">
                      <Info className="w-4 h-4 text-[#00D4FF] shrink-0 mt-0.5" />
                      <span>
                        Static frontend website: submitting opens your email application via{' '}
                        <code className="text-[#00D4FF]">mailto:</code> so you can send
                        your inquiry directly without any backend server or database.
                      </span>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* ===================================================================== */}
      {/* 12. FOOTER                                                            */}
      {/* ===================================================================== */}
      <footer className="bg-[#010713] border-t border-[#00D4FF]/15 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 pb-12 border-b border-[#00D4FF]/10">
            <div>
              <BrandLogo showTagline={true} />
              <p className="text-sm text-[#B8C7DA] mt-4 leading-relaxed">
                Delivering custom software engineering, QR code validation systems,
                enterprise Java applications, and cloud solutions for businesses, startups,
                NGOs, and organizations.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-4">
                Quick Links
              </h4>
              <ul className="space-y-2.5 text-sm text-[#B8C7DA]">
                <li>
                  <a
                    href="#home"
                    onClick={() => handleNavClick('#home')}
                    className="hover:text-[#00D4FF] transition-colors"
                  >
                    Home
                  </a>
                </li>
                <li>
                  <a
                    href="#about"
                    onClick={() => handleNavClick('#about')}
                    className="hover:text-[#00D4FF] transition-colors"
                  >
                    About
                  </a>
                </li>
                <li>
                  <a
                    href="#visiting-card"
                    onClick={() => handleNavClick('#visiting-card')}
                    className="hover:text-[#00D4FF] transition-colors"
                  >
                    Visiting Card
                  </a>
                </li>
                <li>
                  <a
                    href="#services"
                    onClick={() => handleNavClick('#services')}
                    className="hover:text-[#00D4FF] transition-colors"
                  >
                    Services
                  </a>
                </li>
                <li>
                  <a
                    href="#technologies"
                    onClick={() => handleNavClick('#technologies')}
                    className="hover:text-[#00D4FF] transition-colors"
                  >
                    Technologies
                  </a>
                </li>
                <li>
                  <a
                    href="#contact"
                    onClick={() => handleNavClick('#contact')}
                    className="hover:text-[#00D4FF] transition-colors"
                  >
                    Contact
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-4">
                Services
              </h4>
              <ul className="space-y-2.5 text-sm text-[#B8C7DA]">
                <li>
                  <a
                    href="#services"
                    onClick={() => handleNavClick('#services')}
                    className="hover:text-[#00D4FF] transition-colors"
                  >
                    Software Development
                  </a>
                </li>
                <li>
                  <a
                    href="#services"
                    onClick={() => handleNavClick('#services')}
                    className="hover:text-[#00D4FF] transition-colors"
                  >
                    QR Applications
                  </a>
                </li>
                <li>
                  <a
                    href="#services"
                    onClick={() => handleNavClick('#services')}
                    className="hover:text-[#00D4FF] transition-colors"
                  >
                    Mobile Applications
                  </a>
                </li>
                <li>
                  <a
                    href="#services"
                    onClick={() => handleNavClick('#services')}
                    className="hover:text-[#00D4FF] transition-colors"
                  >
                    Cloud Solutions
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-4">
                Contact
              </h4>
              <ul className="space-y-2.5 text-sm text-[#B8C7DA]">
                <li>
                  <a
                    href={`tel:${COMPANY_INFO.phoneRaw}`}
                    className="inline-flex items-center gap-2 hover:text-[#00D4FF] transition-colors"
                  >
                    <Phone className="w-4 h-4 text-[#00D4FF] shrink-0" />
                    <span>{COMPANY_INFO.phoneDisplay}</span>
                  </a>
                </li>
                <li>
                  <a
                    href={`mailto:${COMPANY_INFO.email}`}
                    className="inline-flex items-center gap-2 hover:text-[#00D4FF] transition-colors break-all"
                  >
                    <Mail className="w-4 h-4 text-[#00D4FF] shrink-0" />
                    <span>{COMPANY_INFO.email}</span>
                  </a>
                </li>
                <li>
                  <a
                    href={COMPANY_INFO.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 hover:text-[#00D4FF] transition-colors break-all"
                  >
                    <Linkedin className="w-4 h-4 text-[#00D4FF] shrink-0" />
                    <span>linkedin.com/in/dharmarouthu009</span>
                  </a>
                </li>
                <li className="inline-flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#00D4FF] shrink-0" />
                  <span>{COMPANY_INFO.location}</span>
                </li>
                <li>
                  <a
                    href={`https://wa.me/${COMPANY_INFO.whatsappNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-emerald-400 font-semibold hover:text-emerald-300"
                  >
                    <MessageCircle className="w-4 h-4 shrink-0" />
                    <span>WhatsApp Chat</span>
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 flex flex-wrap items-center justify-between gap-4 text-xs text-[#7F95B2]">
            <span>Copyright &copy; 2026 DN TECH SOLUTIONS. All Rights Reserved.</span>
            <span>{COMPANY_INFO.tagline}</span>
          </div>
        </div>
      </footer>

      {/* ===================================================================== */}
      {/* SERVICE DETAIL MODAL                                                  */}
      {/* ===================================================================== */}
      {selectedService && (
        <div
          className="fixed inset-0 z-50 bg-[#010610]/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setSelectedService(null)}
        >
          <div
            className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-3xl bg-[#06162E] border border-[#00D4FF]/45 p-6 sm:p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-service-title"
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#006BFF]/25 text-[#00D4FF] mb-2">
                  Service Category {selectedService.code}
                </span>
                <h3 id="modal-service-title" className="text-2xl font-extrabold text-white">
                  {selectedService.title}
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close service modal"
                onClick={() => setSelectedService(null)}
                className="p-2 rounded-xl border border-[#00D4FF]/25 text-[#B8C7DA] hover:text-white hover:border-[#00D4FF]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm sm:text-base text-[#B8C7DA] leading-relaxed mb-6">
              {selectedService.overview}
            </p>

            <div className="flex flex-wrap gap-2.5 mb-7">
              {selectedService.items.map((cap) => (
                <span
                  key={cap}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#006BFF]/15 border border-[#00D4FF]/25 text-xs sm:text-sm font-medium text-white"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#00D4FF] shrink-0" />
                  {cap}
                </span>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href="#contact"
                onClick={() => {
                  setSelectedService(null);
                  handleNavClick('#contact');
                }}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white dn-gradient-btn"
              >
                Request Consultation
                <ArrowRight className="w-4 h-4" />
              </a>
              <button
                type="button"
                onClick={() => setSelectedService(null)}
                className="px-5 py-3 rounded-xl text-sm font-semibold text-white bg-[#020B1C] border border-[#00D4FF]/30 hover:border-[#00D4FF]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* BACK TO TOP BUTTON                                                    */}
      {/* ===================================================================== */}
      {showBackToTop && (
        <button
          type="button"
          aria-label="Scroll back to top"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed right-6 bottom-6 z-40 w-11 h-11 rounded-xl dn-gradient-btn text-white flex items-center justify-center"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
