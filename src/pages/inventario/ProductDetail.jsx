import React, { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { MdArrowBack, MdRestaurantMenu, MdWarehouse, MdSchedule, MdImageNotSupported, MdEdit, MdMoveToInbox, MdSwapVert } from 'react-icons/md'
import api, { errorMessage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { Badge, Card, Empty, Spinner, useToast } from '../../components/ui'
import { formatDateTime, formatMoney } from '../../utils/format'
import { PromoTag, promoValue, timeLeft, whenText } from './promotions'
import { AREAS, fmtQty, MovementModal, UNITS, useWarehouses } from './common'
import { ProductForm } from './ProductsPage'
import { notifyStock } from '../../components/StockAlerts'

const ADMIN = ['superadmin', 'admin']

// Ficha del producto: galería, precio (con promoción), existencias por bodega, movimientos y promociones próximas.
const ProductDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const admin = ADMIN.includes(user.role)
  const [p, setP] = useState(null)
  const [categories, setCategories] = useState([])
  const [error, setError] = useState('')
  const [img, setImg] = useState(0)
  const [modal, setModal] = useState(null)
  const [, tick] = useState(0)
  const [toast, toastNode] = useToast()
  const { sites, warehouses, main } = useWarehouses()
  const load = useCallback(() => { api.get(`/inventario/productos/${id}`, { params: { sede: undefined } }).then(({ data }) => setP(data)).catch((e) => setError(errorMessage(e))) }, [id])
  useEffect(() => { load() }, [load])
  useEffect(() => { if (admin) api.get('/inventario/categorias').then(({ data }) => setCategories(data)).catch(() => {}) }, [admin])
  // La cuenta regresiva de la promoción se refresca cada minuto.
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 60000); return () => clearInterval(t) }, [])
  if (error) return <Card><Empty icon={<MdRestaurantMenu />}>{error}</Empty></Card>
  if (!p) return <div className="splash"><Spinner /></div>
  const images = [p.photoUrl, ...(p.gallery || [])].filter(Boolean)
  const left = p.promo?.endsAt ? timeLeft(p.promo.endsAt) : null
  const changed = (msg, alerts) => { setModal(null); toast(msg); notifyStock(alerts); load() }
  return (
    <div className="stack">
      <div className="row-between">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/productos')}><MdArrowBack /> Productos</button>
        {admin && <div className="row-end">
          {p.trackStock && <button type="button" className="btn btn-sm" onClick={() => setModal('move')}><MdMoveToInbox /> Entrada o ajuste</button>}
          <button type="button" className="btn btn-sm btn-primary" onClick={() => setModal('edit')}><MdEdit /> Editar</button>
        </div>}
      </div>
      <div className="pdp">
        <div className="pdp-gallery">
          <div className="pdp-main">
            {images.length ? <img src={images[img] || images[0]} alt={p.name} /> : <span className="pdp-noimg">{p.categoryEmoji ? <span style={{ fontSize: 56 }}>{p.categoryEmoji}</span> : <MdImageNotSupported />} Sin foto</span>}
            {p.promo && <span className="pdp-ribbon"><PromoTag p={p.promo} size="lg" /></span>}
          </div>
          {images.length > 1 && (
            <div className="pdp-thumbs">{images.map((src, i) => (
              <button key={i} type="button" className={i === img ? 'on' : ''} onClick={() => setImg(i)} aria-label={`Imagen ${i + 1}`}><img src={src} alt="" /></button>
            ))}</div>
          )}
        </div>
        <div className="pdp-info">
          <div className="chip-list">
            <Badge>{p.categoryEmoji} {p.category || 'Sin categoría'}</Badge>
            {p.area && <Badge tone="muted">{AREAS[p.area]}</Badge>}
            {!p.active && <Badge tone="muted">Inactivo</Badge>}
            {!p.showInMenu && <Badge tone="muted">No sale en la carta</Badge>}
            {p.sku && <small className="muted">SKU {p.sku}</small>}
          </div>
          <h1>{p.name}</h1>
          <div className="pdp-price">
            {p.promo ? <>
              <span className="pdp-final">{formatMoney(p.finalPrice)}</span>
              <span className="pdp-list"><s>{formatMoney(p.price)}</s> <b style={{ color: p.promo.color }}>{promoValue(p.promo)}</b></span>
              <span className="pdp-save">El cliente ahorra {formatMoney(p.promo.savings)} con {p.promo.emoji} {p.promo.name}{left ? ` · termina en ${left}` : p.promo.timeTo ? ` · hoy hasta las ${p.promo.timeTo}` : ''}</span>
            </> : <span className="pdp-final">{formatMoney(p.price)}</span>}
            <small className="muted">Precio de venta por {UNITS[p.unit]?.toLowerCase()}</small>
          </div>
          <div className="pdp-stock">
            {!p.trackStock ? <small className="muted">Se prepara al momento: no maneja inventario.</small> : <>
              <strong className={p.stock > 0 ? '' : 'text-bad'}>{p.stock > 0 ? `${fmtQty(p.stock, p.unit)} en total` : 'Agotado'}</strong>
              {p.lowStock && p.stock > 0 && <Badge tone="warn">Stock bajo</Badge>}
              <small className="muted">· mínimo por bodega {fmtQty(p.minStock, p.unit)}</small>
            </>}
          </div>
          {p.description && <div className="pdp-desc"><h3>Descripción</h3><p>{p.description}</p></div>}
          {admin && <dl className="stat-list"><div><dt>Costo</dt><dd className="money">{formatMoney(p.cost)}</dd></div><div><dt>Margen</dt><dd>{p.finalPrice ? `${Math.round(((p.finalPrice - p.cost) / p.finalPrice) * 100)} %` : '—'}</dd></div><div><dt>Proveedor</dt><dd>{p.supplier ? <Link to="/proveedores">{p.supplier}</Link> : '—'}</dd></div></dl>}
        </div>
      </div>
      <div className="grid grid-2">
        {p.trackStock && (
          <Card title="Existencias por bodega" icon={<MdWarehouse />} flush>
            {!p.byWarehouse.length ? <Empty>Sin existencias en ninguna bodega.</Empty> : (
              <table className="table"><tbody>{p.byWarehouse.map((w) => (
                <tr key={w.warehouseId}><td><strong>{w.name}</strong>{w.isMain ? <small className="muted"> · principal</small> : w.site && <small className="muted"> · {w.site}</small>}</td>
                  <td className="num">{w.low ? <Badge tone={w.stock > 0 ? 'warn' : 'bad'}>{fmtQty(w.stock, p.unit)}</Badge> : <strong>{fmtQty(w.stock, p.unit)}</strong>}</td></tr>
              ))}</tbody></table>
            )}
          </Card>
        )}
        <Card title="Próximas promociones" icon={<MdSchedule />}>
          {!p.upcoming.length ? <small className="muted">No hay otras promociones programadas para este producto.</small> : (
            <ul className="pdp-upcoming">{p.upcoming.map((x) => (
              <li key={x.id}><PromoTag p={x} size="sm" /><div><strong>{x.name} · {formatMoney(x.price)}</strong><small className="muted">{whenText(x)}</small></div></li>
            ))}</ul>
          )}
        </Card>
      </div>
      {p.trackStock && (
        <Card title="Últimos movimientos" icon={<MdSwapVert />} flush>
          {!p.movements.length ? <Empty>Sin movimientos todavía.</Empty> : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Fecha</th><th>Tipo</th><th className="hide-sm">Bodega</th><th className="num">Cant.</th><th className="num hide-sm">Quedó</th><th className="hide-md">Detalle</th></tr></thead>
              <tbody>{p.movements.map((m) => (
                <tr key={m.id}>
                  <td><small>{formatDateTime(m.createdAt)}</small></td>
                  <td>{m.typeLabel}{m.ref && <small className="block">{m.ref}</small>}</td>
                  <td className="hide-sm">{m.warehouse?.name}</td>
                  <td className={`num ${m.quantity > 0 ? 'text-ok' : 'text-bad'}`}><strong>{m.quantity > 0 ? '+' : ''}{fmtQty(m.quantity)}</strong></td>
                  <td className="num hide-sm">{m.stockAfter === null ? '—' : fmtQty(m.stockAfter)}</td>
                  <td className="hide-md"><small>{[m.note, m.user].filter(Boolean).join(' · ') || '—'}</small></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </Card>
      )}
      {modal === 'edit' && <ProductForm initial={p} categories={categories} sites={sites} warehouses={warehouses} main={main} onClose={() => setModal(null)} onSaved={() => changed('Producto actualizado')} />}
      {modal === 'move' && warehouses && <MovementModal products={[p]} sites={sites} warehouses={warehouses} defaults={{ warehouseId: main ? String(main.id) : '', productId: p.id }} onClose={() => setModal(null)} onSaved={changed} />}
      {toastNode}
    </div>
  )
}

export default ProductDetail
