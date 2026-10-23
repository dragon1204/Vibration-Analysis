import { Badge, Tag } from 'antd'
import { installationTemplates, type InstallationTemplate } from '../config/installationTemplates'
import { sensorCode } from '../utils/format'

export function templateById(id?: string): InstallationTemplate {
  return installationTemplates.find((item) => item.id === id) || installationTemplates[0]
}

export default function InstallationDiagram({ templateId, points }: { templateId?: string; points: any[] }) {
  const template = templateById(templateId)
  const installed = new Set(points.map(sensorCode))
  return <div className="installation-diagram">
    <div className="installation-image-wrap">
      <img src={template.image} alt={template.name} className="installation-image" />
      {template.locations.map((location) => {
        const marker = template.markers[location]
        const active = installed.has(location)
        return <div key={location} className={`installation-marker ${active ? 'is-installed' : 'is-empty'}`} style={{ left: `${marker.x}%`, top: `${marker.y}%` }}>
          <Badge status={active ? 'success' : 'default'} /><strong>{location}</strong>
          <small>{active ? 'Đang lắp' : 'Chưa lắp'}</small>
        </div>
      })}
    </div>
    <div className="installation-legend">
      {template.locations.map((location) => <Tag key={location} color={installed.has(location) ? 'green' : 'default'}>{location} · {installed.has(location) ? 'Đã lắp' : 'Chưa lắp'}</Tag>)}
    </div>
  </div>
}
