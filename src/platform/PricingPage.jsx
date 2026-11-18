import React, { useEffect, useMemo, useState } from 'react'
import {
  MdCheck, MdRemove, MdArrowForward, MdStar, MdTableRestaurant, MdPointOfSale, MdQrCode2, MdSoupKitchen, MdInventory2, MdAccountBalance,
  MdBarChart, MdNotificationsActive, MdPhoneIphone, MdCloudDone, MdShield, MdPublic, MdPeople, MdTrendingUp
} from 'react-icons/md'
import api from '../api/client'
import { BrandLogo } from '../components/Logo'
import { Spinner } from '../components/ui'
import { CountrySelect, Flag, limitText, moneyIn } from '../utils/countries'
import './pricing.css'

// Contacto comercial: WhatsApp si está configurado, si no, correo.
const SALES_WA = import.meta.env.VITE_SALES_WHATSAPP || ''
const SALES_MAIL = import.meta.env.VITE_SALES_EMAIL || ''
const contactLink = (text) => (SALES_WA ? `https://wa.me/${SALES_WA}?text=${encodeURIComponent(text)}` : `mailto:${SALES_MAIL}?subject=${encodeURIComponent(text)}`)

const MODULES = [
  [MdTableRestaurant, 'Mesas y pedidos', 'Abre la mesa, toma el pedido con propina y cortesías, y traslada la cuenta a otra mesa en un toque.'],
  [MdQrCode2, 'Carta por QR', 'El cliente escanea el QR de su mesa, ve la carta con fotos, llama al mesero o hace su pedido.'],
  [MdSoupKitchen, 'Comandas de cocina y bar', 'Cada pedido llega a cocina o barra con su tiempo de espera y avisa cuando está listo.'],
  [MdPointOfSale, 'Caja y propinas', 'Apertura con base, pagos mixtos, gastos del turno, cierre con arqueo y reparto de propinas.'],
  [MdInventory2, 'Inventario por bodega', 'Bodega principal y una por sucursal, traslados y alertas cuando un producto se va acabando.'],
  [MdAccountBalance, 'Finanzas y socios', 'Bóveda, fondos por sucursal, gastos, aportes, utilidades y retiros de cada socio.'],
  [MdBarChart, 'Reportes', 'Ventas por día, semana o rango; productos, meseros, propinas y cuánto vende cada mesa por hora.'],
  [MdNotificationsActive, 'Avisos al instante', 'Sonido y notificación cuando una mesa llama, y avisos por Telegram para cada sucursal.']
]
const WHY = [[MdPhoneIphone, 'Funciona en el celular del mesero'], [MdCloudDone, 'En la nube, sin instalar nada'], [MdShield, 'Cada establecimiento con su información aparte'], [MdPublic, 'Precios en la moneda de tu país']]
const LIMIT_ROWS = [['sites', 'Sucursales'], ['admins', 'Administradores'], ['employees', 'Empleados'], ['tables', 'Mesas'], ['products', 'Productos']]
const GROUPS = { operacion: 'Operación', catalogo: 'Catálogo', clientes: 'Clientes', control: 'Control', marca: 'Marca' }

// Ilustración del salón en la noche (datos de muestra).
const FloorMock = ({ fmt }) => (
  <div className="pr-mock" aria-hidden="true">
    <div className="pr-mock-bar"><span /><span /><span /><em>Salón · hoy</em></div>
    <div className="pr-mock-body">
      <div className="pr-mock-kpis">
        <div><small>Ventas de hoy</small><b>{fmt(2480000)}</b><i className="up"><MdTrendingUp /> 18 % más que el viernes</i></div>
        <div><small>Mesas ocupadas</small><b>11 / 16</b><i>5 libres</i></div>
        <div><small>En cocina</small><b>7</b><i className="warn">comandas</i></div>
      </div>
      <div className="pr-mock-stops">
        {[['Mesa 4', 'Pide la cuenta · 4 pers.', 186000, 'bad'], ['Terraza 2', '2 platos listos', 142000, 'ok'], ['Barra 1', 'Llama al mesero', 48000, ''], ['Mesa 9', 'Pedido por QR', 97000, 'ok']].map(([n, x, v, t], i) => (
          <div key={n} className={`pr-stop ${t}`}><span className="n">{i + 1}</span><div><b>{n}</b><small><MdPeople /> {x}</small></div><strong>{fmt(v)}</strong></div>
        ))}
      </div>
    </div>
  </div>
)

const pickInitial = () => {
  const q = new URLSearchParams(window.location.search).get('pais')
  if (q) return q.toUpperCase()
  try { return localStorage.getItem('td_pais') || 'CO' } catch { return 'CO' }
}

// Página de presentación de planes para clientes: precios en la moneda del país elegido.
const PricingPage = () => {
  const [code, setCode] = useState(pickInitial)
  const [d, setD] = useState(null)
  const [cycle, setCycle] = useState('mensual')
  useEffect(() => {
    api.get('/publico/precios', { params: { pais: code } }).then(({ data }) => setD(data)).catch(() => setD((x) => x || { plans: [], countries: [], features: [], country: null }))
    try { localStorage.setItem('td_pais', code) } catch { /* sin almacenamiento */ }
    const url = new URL(window.location.href); url.searchParams.set('pais', code); window.history.replaceState(null, '', url)
  }, [code])
  useEffect(() => { const t = document.title; document.title = 'Planes y precios · TillDash+'; return () => { document.title = t } }, [])
  const groups = useMemo(() => (d ? Object.entries(GROUPS).map(([g, l]) => [g, l, d.features.filter((f) => f.group === g)]).filter(([, , fs]) => fs.length) : []), [d])
  if (!d) return <div className="pr pr-loading"><Spinner /></div>
  const c = d.country
  const fmt = (v) => moneyIn(v, c?.currency || 'COP', c?.locale || 'es-CO')
  // Los montos de la ilustración se escalan a la moneda del país (proporcional al precio del primer plan).
  const ratio = d.plans[0] ? d.plans[0].priceMonth / 79900 : 1
  const mockFmt = (v) => { const x = v * ratio; const step = x >= 10000 ? 1000 : x >= 100 ? 5 : 1; return fmt(Math.round(x / step) * step) }
  const price = (p) => (cycle === 'anual' ? p.priceYear / 12 : p.priceMonth)
  const disc = d.plans[0]?.annualDiscount ?? 16.7
  return (
    <div className="pr">
      <header className="pr-nav">
        <div className="pr-wrap pr-nav-in">
          <BrandLogo size={30} onDark />
          <nav><a href="#modulos">Módulos</a><a href="#planes">Planes</a><a href="#comparar">Comparar</a></nav>
          <div className="pr-nav-right">
            <CountrySelect countries={d.countries} value={c?.code} onChange={setCode} dark />
            <a className="pr-login" href="/login">Ingresar</a>
          </div>
        </div>
      </header>

      <div className="pr-wrap">
        <section className="pr-hero">
          <div>
            <div className="pr-eyebrow">Software para restaurantes, bares y discotecas</div>
            <h1>Tu salón, tu cocina y tu caja en un solo lugar.</h1>
            <p className="pr-lead">Mesas, pedidos, carta por QR, comandas, caja, inventario y finanzas. Desde el computador, la tablet o el celular del mesero, en {c?.name || 'tu país'} y en {c?.currency || 'tu moneda'}.</p>
            <div className="pr-ctas">
              <a className="pr-cta" href="#planes">Ver planes en {c?.currency} <MdArrowForward /></a>
              <a className="pr-ghost" href={contactLink(`Quiero una demostración de TillDash+ (${c?.name || ''})`)} target="_blank" rel="noreferrer">Solicitar una demostración</a>
            </div>
            <div className="pr-why">{WHY.map(([I, t]) => <span key={t}><I /> {t}</span>)}</div>
          </div>
          <FloorMock fmt={mockFmt} />
        </section>

        <section className="pr-modules" id="modulos">
          <h2>Todo lo que necesita tu establecimiento</h2>
          <div className="pr-mod-grid">{MODULES.map(([I, t, x]) => <div key={t} className="pr-mod"><span><I /></span><b>{t}</b><p>{x}</p></div>)}</div>
        </section>

        <section id="planes">
          <div className="pr-top">
            <div>
              <div className="pr-eyebrow">Planes y precios · <Flag code={c?.code} size={12} /> {c?.name} · {c?.currency}</div>
              <h2>Un plan para cada tamaño de establecimiento</h2>
            </div>
            <div className="pr-cycle" role="tablist" aria-label="Ciclo de pago">
              <button type="button" className={cycle === 'mensual' ? 'on' : ''} onClick={() => setCycle('mensual')}>Mensual</button>
              <button type="button" className={cycle === 'anual' ? 'on' : ''} onClick={() => setCycle('anual')}>Anual <em>−{String(disc).replace('.', ',')} %</em></button>
            </div>
          </div>
          {!d.plans.length ? <p className="pr-lead">Pronto tendremos planes para {c?.name}. Escríbenos y te contamos.</p> : (
            <div className="pr-tiers">
              {d.plans.map((p) => (
                <div key={p.id} className={`pr-tier${p.highlight ? ' hl' : ''}`}>
                  {p.highlight && <div className="ribbon"><MdStar /> {p.badge || 'Recomendado'}</div>}
                  <h3>{p.name}</h3>
                  <p className="tag">{p.tagline}</p>
                  <div className="amount">{fmt(price(p))}<small>/mes</small></div>
                  <div className="note">{cycle === 'anual' ? `Pago anual de ${fmt(p.priceYear)}` : 'Pago mensual'} · {p.currency}{p.trialDays ? ` · ${p.trialDays} días de prueba` : ''}</div>
                  <a className="cta" href={contactLink(`Quiero el plan ${p.name} (${cycle}) de TillDash+ en ${c?.name}`)} target="_blank" rel="noreferrer">Elegir {p.name} <MdArrowForward /></a>
                  <hr />
                  <ul>{p.bullets.map((b) => <li key={b}><MdCheck /> {b}</li>)}</ul>
                  <div className="foot">Soporte: {p.support || 'WhatsApp'}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        {!!d.plans.length && (
          <section className="pr-compare" id="comparar">
            <h2>Compara los planes</h2>
            <div className="pr-table-wrap">
              <table>
                <thead><tr><th>Incluye</th>{d.plans.map((p) => <th key={p.id}>{p.name}</th>)}</tr></thead>
                <tbody>
                  <tr><td>Precio {cycle === 'anual' ? '(mes, pago anual)' : 'mensual'}</td>{d.plans.map((p) => <td key={p.id}><b>{fmt(price(p))}</b></td>)}</tr>
                  {LIMIT_ROWS.map(([k, l]) => <tr key={k}><td>{l}</td>{d.plans.map((p) => <td key={p.id}>{p.limits[k] === 0 ? <MdRemove className="no" /> : limitText(p.limits[k])}</td>)}</tr>)}
                  {groups.map(([g, l, fs]) => (
                    <React.Fragment key={g}>
                      <tr className="grp"><td colSpan={d.plans.length + 1}>{l}</td></tr>
                      {fs.map((f) => <tr key={f.key}><td title={f.description}>{f.label}</td>{d.plans.map((p) => <td key={p.id}>{p.features.includes(f.key) ? <MdCheck className="yes" /> : <MdRemove className="no" />}</td>)}</tr>)}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="pr-countries">
          <h3><MdNotificationsActive /> TillDash+ en Latinoamérica</h3>
          <div className="pr-flag-list">
            {d.countries.map((x) => (
              <button key={x.code} type="button" className={x.code === c?.code ? 'on' : ''} onClick={() => { setCode(x.code); document.getElementById('planes')?.scrollIntoView({ behavior: 'smooth' }) }}>
                <Flag code={x.code} size={16} /> {x.name} <b>{x.currency}</b>
              </button>
            ))}
          </div>
        </section>
        <p className="pr-legal">Precios en {c?.currencyName} ({c?.currency}) para establecimientos en {c?.name}. Impuestos según la ley de cada país. © {new Date().getFullYear()} TillDash+.</p>
      </div>
    </div>
  )
}

export default PricingPage
