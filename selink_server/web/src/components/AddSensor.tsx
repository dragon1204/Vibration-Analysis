import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Button, Checkbox, InputNumber, Modal } from 'antd'
import { ApiError, api, post } from '../api/client'

type Slot = { slot: number; location: string; label: string; short: string; role: string; point: { id: string; name: string } | null }

/** Add a sensor to a machine: choose where it is mounted (DE, NDE, BASE, COMP) and its Modbus address. */
export default function AddSensor({ machineId }: { machineId: string }) {
  const { message } = App.useApp()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [slot, setSlot] = useState<number>()
  const [addr, setAddr] = useState<number | null>(null)
  const [fresh, setFresh] = useState(true)
  const [busy, setBusy] = useState(false)
  const { data } = useQuery<{ slots: Slot[]; used_addrs: number[] }>({
    queryKey: ['sensor-slots', machineId], queryFn: () => api(`/machines/${machineId}/sensor-slots`), enabled: open,
  })
  const slots = data?.slots || []
  const used = data?.used_addrs || []
  const free = (a: number) => !used.includes(a)
  const suggested = [3, 4, 5, 6, 7, 8].find(free) || 9
  const addrValue = addr ?? suggested
  const valid = !!slot && Number.isInteger(addrValue) && addrValue >= 1 && addrValue <= 127 && free(addrValue)

  const submit = async () => {
    if (!slot) return
    setBusy(true)
    try {
      const r = await post(`/machines/${machineId}/sensors`, { slot, addr: addrValue, commission: fresh })
      message.success(`Đã thêm cảm biến ${r.name}. Gateway sẽ nhận cấu hình trong ít giây.`)
      setOpen(false); setSlot(undefined); setAddr(null)
      qc.invalidateQueries({ queryKey: ['machine', machineId] })
      qc.invalidateQueries({ queryKey: ['status', machineId] })
      qc.invalidateQueries({ queryKey: ['sensor-slots', machineId] })
    } catch (e) {
      message.error(e instanceof ApiError ? e.message : 'Không thêm được cảm biến')
    } finally { setBusy(false) }
  }

  return <>
    <Button onClick={() => setOpen(true)}>Thêm cảm biến</Button>
    <Modal open={open} title="Thêm cảm biến" onCancel={() => setOpen(false)} okText="Thêm cảm biến" cancelText="Hủy"
      onOk={submit} okButtonProps={{ disabled: !valid, loading: busy }} width={560} destroyOnClose>
      <div className="slot-label">Vị trí lắp</div>
      <div className="slot-grid">
        {slots.map((s) => (
          <button key={s.slot} type="button" disabled={!!s.point} className={`slot-card ${slot === s.slot ? 'active' : ''}`} onClick={() => setSlot(s.slot)}>
            <b>{s.short}</b>
            <span>{s.label}</span>
            <em>{s.point ? `Đã có: ${s.point.name}` : s.role === 'bearing' ? 'Ổ đỡ, tính vùng ISO' : 'Không tính vùng ISO'}</em>
          </button>
        ))}
      </div>
      <div className="slot-label">Địa chỉ Modbus (1 đến 127)</div>
      <InputNumber min={1} max={127} value={addrValue} onChange={(v) => setAddr(v)} status={free(addrValue) ? undefined : 'error'} />
      {!free(addrValue) && <span className="slot-error">Địa chỉ này đã dùng cho cảm biến khác</span>}
      <div className="slot-label">Cảm biến</div>
      <Checkbox checked={fresh} onChange={(e) => setFresh(e.target.checked)}>Cảm biến mới, chưa đặt địa chỉ: gateway tự đặt địa chỉ này cho cảm biến</Checkbox>
      <p className="slot-note">Chỉ cắm <b>một</b> cảm biến mới mỗi lần, cùng đường RS485 với các cảm biến đang chạy. Nếu bỏ chọn ô trên, cảm biến phải đã được đặt đúng địa chỉ.</p>
    </Modal>
  </>
}
