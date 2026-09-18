/**
 * Computes a side-by-side column layout for overlapping calendar blocks.
 * Blocks that overlap in time are grouped into clusters; within each cluster,
 * blocks are assigned to columns so they render side-by-side instead of
 * stacking on top of each other.
 *
 * @param {Array<{id: string, top: number, height: number}>} blocks
 * @returns {Map<string, {column: number, totalColumns: number}>}
 */
export function computeLayout(blocks) {
  const layout = new Map();
  if (!blocks || blocks.length === 0) return layout;

  const sorted = [...blocks].sort((a, b) => a.top - b.top || b.height - a.height);

  // Group overlapping blocks into clusters
  const clusters = [];
  let currentCluster = null;
  let clusterEnd = 0;

  for (const block of sorted) {
    if (!currentCluster || block.top >= clusterEnd) {
      currentCluster = [block];
      clusters.push(currentCluster);
      clusterEnd = block.top + block.height;
    } else {
      currentCluster.push(block);
      clusterEnd = Math.max(clusterEnd, block.top + block.height);
    }
  }

  // Assign columns within each cluster (greedy)
  for (const cluster of clusters) {
    const columns = [];
    for (const block of cluster) {
      let placed = false;
      for (let ci = 0; ci < columns.length; ci++) {
        const col = columns[ci];
        const last = col[col.length - 1];
        if (last.top + last.height <= block.top) {
          col.push(block);
          layout.set(block.id, { column: ci, totalColumns: 0 });
          placed = true;
          break;
        }
      }
      if (!placed) {
        columns.push([block]);
        layout.set(block.id, { column: columns.length - 1, totalColumns: 0 });
      }
    }
    const total = columns.length;
    for (const block of cluster) {
      layout.get(block.id).totalColumns = total;
    }
  }

  return layout;
}