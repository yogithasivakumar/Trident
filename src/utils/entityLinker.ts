export class EntityGraph {
  private adjList: Map<string, Set<string>> = new Map();
  private nodeLabels: Map<string, { type: 'customer' | 'device' | 'ip' | 'payee'; name?: string }> = new Map();

  addNode(id: string, type: 'customer' | 'device' | 'ip' | 'payee', name?: string) {
    if (!this.adjList.has(id)) {
      this.adjList.set(id, new Set());
    }
    this.nodeLabels.set(id, { type, name });
  }

  addEdge(node1: string, node2: string) {
    if (!this.adjList.has(node1)) this.adjList.set(node1, new Set());
    if (!this.adjList.has(node2)) this.adjList.set(node2, new Set());

    this.adjList.get(node1)!.add(node2);
    this.adjList.get(node2)!.add(node1);
  }

  // Find all nodes in the connected component of a starting node
  getConnectedComponent(startNode: string): string[] {
    if (!this.adjList.has(startNode)) return [];

    const visited = new Set<string>();
    const queue: string[] = [startNode];
    visited.add(startNode);

    let head = 0;
    while (head < queue.length) {
      const curr = queue[head++];
      const neighbors = this.adjList.get(curr);
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
    }

    return Array.from(visited);
  }

  // Get specific linked entity details
  getLinkedEntities(customerId: string) {
    const component = this.getConnectedComponent(customerId);
    
    const customers: string[] = [];
    const devices: string[] = [];
    const ips: string[] = [];
    const payees: string[] = [];

    component.forEach(nodeId => {
      const info = this.nodeLabels.get(nodeId);
      if (info) {
        if (info.type === 'customer') {
          customers.push(info.name || nodeId);
        } else if (info.type === 'device') {
          devices.push(nodeId);
        } else if (info.type === 'ip') {
          ips.push(nodeId);
        } else if (info.type === 'payee') {
          payees.push(nodeId);
        }
      }
    });

    return {
      customers: Array.from(new Set(customers)),
      devices: Array.from(new Set(devices)),
      ips: Array.from(new Set(ips)),
      payees: Array.from(new Set(payees))
    };
  }
}
