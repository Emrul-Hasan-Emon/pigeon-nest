import type { CategoryTreeNode } from '@/types/category';

export interface FlatCategory {
  id: number;
  name: string;
  depth: number;
}

function collectIds(node: CategoryTreeNode, into: Set<number>) {
  into.add(node.id);
  for (const child of node.children) collectIds(child, into);
}

/** Flat, depth-aware list for a parent dropdown. Excludes a node and its descendants. */
export function flattenCategoryTree(
  nodes: CategoryTreeNode[],
  excludeId?: number,
): FlatCategory[] {
  const excluded = new Set<number>();
  if (excludeId !== undefined) {
    function findAndCollect(list: CategoryTreeNode[]): boolean {
      for (const node of list) {
        if (node.id === excludeId) {
          collectIds(node, excluded);
          return true;
        }
        if (findAndCollect(node.children)) return true;
      }
      return false;
    }
    findAndCollect(nodes);
  }

  const out: FlatCategory[] = [];
  function walk(list: CategoryTreeNode[], depth: number) {
    for (const node of list) {
      if (excluded.has(node.id)) continue;
      out.push({ id: node.id, name: node.name, depth });
      walk(node.children, depth + 1);
    }
  }
  walk(nodes, 0);
  return out;
}

/** Finds a node anywhere in the tree by id. */
export function findCategoryNode(
  nodes: CategoryTreeNode[],
  id: number,
): CategoryTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findCategoryNode(node.children, id);
    if (found) return found;
  }
  return null;
}

/** Ordered ancestor names (root first), excluding the node itself. */
export function findAncestorNames(nodes: CategoryTreeNode[], id: number): string[] {
  function walk(list: CategoryTreeNode[], trail: string[]): string[] | null {
    for (const node of list) {
      if (node.id === id) return trail;
      const found = walk(node.children, [...trail, node.name]);
      if (found) return found;
    }
    return null;
  }
  return walk(nodes, []) ?? [];
}
