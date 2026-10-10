import type { ManagementDepartment } from '@/services/ioc/management-department.service';

export function flattenTree(nodes: ManagementDepartment[]): ManagementDepartment[] {
  const result: ManagementDepartment[] = [];
  const visit = (items: ManagementDepartment[]) => {
    for (const item of items) {
      result.push(item);
      if (item.children?.length) visit(item.children);
    }
  };
  visit(nodes);
  return result;
}

export function filterTree(nodes: ManagementDepartment[], keyword: string): ManagementDepartment[] {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return nodes;
  const filterNodes = (items: ManagementDepartment[]): ManagementDepartment[] =>
    items
      .map((item) => {
        const filteredChildren = filterNodes(item.children ?? []);
        const matches =
          item.name?.toLowerCase().includes(kw) || item.code?.toLowerCase().includes(kw);
        if (matches || filteredChildren.length > 0) return { ...item, children: filteredChildren };
        return null;
      })
      .filter(Boolean) as ManagementDepartment[];
  return filterNodes(nodes);
}
