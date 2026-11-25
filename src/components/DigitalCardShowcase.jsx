import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { ArrowDownToLine, BriefcaseBusiness, Check, RotateCcw, Linkedin, Mail, MapPin, Phone, QrCode, Sparkles } from 'lucide-react'
import { QR_PROJECTS } from '../data/siteData'
import QrProjectsCarousel from './QrProjectsCarousel'
import { COMPANY_INFO, buildVCardString } from '../data/siteData'

export default function DigitalCardShowcase() {
  const [side, setSide] = useState('front')
  const [qr, setQr] = useState('')
  useEffect(() => { QRCode.toDataURL(buildVCardString(), { width: 240, margin: 1, errorCorrectionLevel: 'Q', color: { dark: '#061934', light: '#ffffff' } }).then(setQr).catch(() => {}) }, [])
  const download = () => {
    const url = URL.createObjectURL(new Blob([buildVCardString()], { type: 'text/vcard;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = 'Dharma_Routhu_DN_Tech_Solutions.vcf'; link.click(); URL.revokeObjectURL(url)
  }
  return <section className="section digital-card-section" id="visiting-card"><div className="container"><div className="digital-card-heading"><div className="eyebrow"><Sparkles size={14} /> YOUR DETAILS, ONE SCAN AWAY</div><h2>Your digital <span className="gradient-text">visiting card.</span></h2><p>Scan the QR code with a phone camera to open your contact app with Dharma’s professional details, including phone, email, company, location and LinkedIn.</p></div>
    <div className="card-switch" role="group" aria-label="Choose visiting card side"><button className={side === 'front' ? 'active' : ''} onClick={() => setSide('front')}><RotateCcw size={15} /> Front of card</button><button className={side === 'back' ? 'active' : ''} onClick={() => setSide('back')}><RotateCcw size={15} /> Services side</button></div>
    <div className="digital-card-wrap"><article className={`digital-card ${side === 'back' ? 'card-back' : ''}`}>{side === 'front' ? <><div className="digital-card-main"><div className="digital-card-person"><div className="card-brand"><span className="brand-mark">D<span>N</span></span><span>DN <b>TECH SOLUTIONS</b><small>IDEAS · TECHNOLOGY · GROWTH</small></span></div><div className="card-rule"/><h3>{COMPANY_INFO.founder}</h3><div className="card-role"><BriefcaseBusiness size={14}/>{COMPANY_INFO.designation}</div><div className="card-contact-list"><a href={`tel:${COMPANY_INFO.phoneRaw}`}><Phone size={15}/>{COMPANY_INFO.phoneDisplay}</a><a href={`mailto:${COMPANY_INFO.email}`}><Mail size={15}/>{COMPANY_INFO.email}</a><a href={COMPANY_INFO.linkedin} target="_blank" rel="noreferrer"><Linkedin size={15}/>linkedin.com/in/dharmarouthu009</a><span><MapPin size={15}/>{COMPANY_INFO.location}</span></div></div><div className="digital-qr">{qr && <img src={qr} alt="Scannable vCard QR with Dharma Routhu’s professional contact details and LinkedIn"/>}<QrCode size={17}/><b>SCAN TO SAVE CONTACT</b><small>Phone · Email · LinkedIn</small></div>
        <QrProjectsCarousel projects={QR_PROJECTS} /></div><div className="digital-card-foot"><span>IDEAS <i/> TECHNOLOGY <i/> GROWTH</span><a href={COMPANY_INFO.linkedin} target="_blank" rel="noreferrer"><Linkedin size={14}/> Connect on LinkedIn</a></div></> : <><div className="back-eyebrow"><Sparkles size={16}/> TECHNOLOGY THAT MOVES YOU FORWARD</div><h3>Ideas into <span>impact.</span></h3><p>Software solutions thoughtfully engineered around your goals.</p><div className="card-service-pills">{['QR & verification systems','Enterprise Java applications','Web & mobile development','Cloud & DevOps','Custom business platforms','Software support & modernization'].map(s=><span key={s}><Check size={13}/>{s}</span>)}</div><a className="button button-primary" href="#contact">Let’s build together <RotateCcw size={15}/></a><div className="back-decoration"><span>DN</span><i/><i/><i/></div></>}</article></div>
    {side === 'front' && <button className="vcard-download" onClick={download}><ArrowDownToLine size={16}/> Download contact (.vcf)</button>}
    <p className="qr-caption">This QR contains an electronic vCard. Scanning opens the device’s contact flow when supported; save the contact to keep all details.</p>
  </div></section>
}
