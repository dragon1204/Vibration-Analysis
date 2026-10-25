import { Badge, Tag } from 'antd'
import { installationTemplates, installationTemplateList, type InstallationTemplate } from '../config/installationTemplates'
import { sensorCode } from '../utils/format'

export function templateById(id?: string, models?: any[]): InstallationTemplate {
  const templates = installationTemplateList(models)
  return templates.find((item) => item.id === id) || templates[0] || installationTemplates[0]
}

export default function InstallationDiagram({ templateId, points, models }: { templateId?: string; points: any[]; models?: any[] }) {
  const template = templateById(templateId, models)
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
