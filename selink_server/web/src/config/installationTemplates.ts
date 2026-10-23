export type InstallationTemplate = {
  id: string
  name: string
  description: string
  image: string
  locations: string[]
  markers: Record<string, { x: number; y: number }>
}

// The images are supplied by the customer. Marker coordinates are percentages
// so the live labels remain aligned as the drawing scales responsively.
export const installationTemplates: InstallationTemplate[] = [
  {
    id: 'motor-de-base',
    name: 'Động cơ — DE + BASE',
    description: 'Động cơ độc lập, giám sát tại DE và BASE.',
    image: '/installation-templates/motor-de-base.jpg',
    locations: ['DE', 'BASE'],
    markers: { DE: { x: 41.2, y: 34.2 }, BASE: { x: 59.4, y: 68.8 } },
  },
  {
    id: 'motor-load-4point',
    name: 'Tổ máy — Load + DE + NDE + BASE',
    description: 'Tổ máy có tải, giám sát bốn vị trí COMP, DE, NDE và BASE.',
    image: '/installation-templates/motor-load-4point.jpg',
    locations: ['COMP', 'DE', 'NDE', 'BASE'],
    markers: { COMP: { x: 28.0, y: 28.8 }, DE: { x: 54.6, y: 33.4 }, NDE: { x: 74.2, y: 23.1 }, BASE: { x: 64.5, y: 66.8 } },
  },
]

export const DEFAULT_INSTALLATION_TEMPLATE = 'motor-de-base'
