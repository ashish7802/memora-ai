'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import {
  Network,
  List,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sliders,
  Search,
  Sparkles,
  Info,
  Filter,
  ArrowRight,
  Database,
  Layers,
  ChevronRight,
  Maximize2,
  X,
  MessageSquare,
} from 'lucide-react';
import { MemoryItem } from '@/lib/memora/types';

export interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  text: string;
  category: string;
  source: string;
  timestamp?: string;
  degree?: number;
}

export interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  similarity: number;
  distance: number;
}

export interface SemanticGraphResponse {
  nodes: GraphNode[];
  links: GraphLink[];
  categories: string[];
}

interface MemorySemanticGraphProps {
  onSelectMemory?: (item: MemoryItem) => void;
  onQueryInChat?: (text: string) => void;
  onNavigateToInject?: () => void;
  highlightQuery?: string;
}

// Category Color Mapping
const CATEGORY_COLORS: Record<string, { bg: string; text: string; fill: string; stroke: string }> = {
  Preference: {
    bg: 'bg-[#5881571A]',
    text: 'text-[#588157]',
    fill: '#588157',
    stroke: '#466845',
  },
  Project: {
    bg: 'bg-[#3D5A801A]',
    text: 'text-[#3D5A80]',
    fill: '#3D5A80',
    stroke: '#293241',
  },
  Strategy: {
    bg: 'bg-[#D4A37326]',
    text: 'text-[#9C6644]',
    fill: '#D4A373',
    stroke: '#BC6C25',
  },
  Architecture: {
    bg: 'bg-[#6B705C26]',
    text: 'text-[#6B705C]',
    fill: '#6B705C',
    stroke: '#4B4F3F',
  },
  Skills: {
    bg: 'bg-[#8F5D5D1A]',
    text: 'text-[#8F5D5D]',
    fill: '#8F5D5D',
    stroke: '#6D4040',
  },
  Vector: {
    bg: 'bg-[#5E503F1A]',
    text: 'text-[#5E503F]',
    fill: '#5E503F',
    stroke: '#3B3228',
  },
  'AI/ML': {
    bg: 'bg-[#2A6F971A]',
    text: 'text-[#2A6F97]',
    fill: '#2A6F97',
    stroke: '#01497C',
  },
  General: {
    bg: 'bg-[#8A817C1A]',
    text: 'text-[#8A817C]',
    fill: '#8A817C',
    stroke: '#6C6561',
  },
};

function getCategoryColor(category: string) {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.General;
}

export default function MemorySemanticGraph({
  onSelectMemory,
  onQueryInChat,
  onNavigateToInject,
  highlightQuery: propHighlightQuery = '',
}: MemorySemanticGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const [rawNodes, setRawNodes] = useState<GraphNode[]>([]);
  const [rawLinks, setRawLinks] = useState<GraphLink[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // View mode
  const [viewMode, setViewMode] = useState<'graph' | 'split' | 'list'>('split');
  const [minSimilarity, setMinSimilarity] = useState<number>(0.25);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  // Search query: derived or user-controlled
  const [userSearchQuery, setUserSearchQuery] = useState<string | null>(null);
  const searchQuery = userSearchQuery !== null ? userSearchQuery : propHighlightQuery;
  const setSearchQuery = (val: string) => setUserSearchQuery(val);

  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [hoveredLink, setHoveredLink] = useState<GraphLink | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 600,
    height: 450,
  });

  const MEMORA_API_URL = process.env.NEXT_PUBLIC_MEMORA_API_URL || 'http://localhost:8000/v1/memory';

  // User-triggered refresh
  const refreshGraphData = async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`${MEMORA_API_URL}/graph?min_similarity=0.1&limit=200`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: SemanticGraphResponse = await res.json();
      setRawNodes(data.nodes || []);
      setRawLinks(data.links || []);
      setCategories(data.categories || []);
      if (data.nodes && data.nodes.length > 0) {
        setSelectedNode((prev) => prev || data.nodes[0]);
      }
    } catch (err: any) {
      setFetchError(err.message || 'Failed to load semantic memory graph');
    } finally {
      setIsLoading(false);
    }
  };

  // Initial graph data load
  useEffect(() => {
    let ignore = false;
    async function loadData() {
      try {
        const res = await fetch(`${MEMORA_API_URL}/graph?min_similarity=0.1&limit=200`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: SemanticGraphResponse = await res.json();
        if (!ignore) {
          setRawNodes(data.nodes || []);
          setRawLinks(data.links || []);
          setCategories(data.categories || []);
          if (data.nodes && data.nodes.length > 0) {
            setSelectedNode((prev) => prev || data.nodes[0]);
          }
          setIsLoading(false);
        }
      } catch (err: any) {
        if (!ignore) {
          setFetchError(err.message || 'Failed to load semantic memory graph');
          setIsLoading(false);
        }
      }
    }
    loadData();
    return () => {
      ignore = true;
    };
  }, [MEMORA_API_URL]);

  // ResizeObserver for responsive container sizing
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Filter nodes and links based on UI state
  const { filteredNodes, filteredLinks } = useMemo(() => {
    let nodes = rawNodes;
    if (selectedCategory !== 'all') {
      nodes = nodes.filter((n) => n.category === selectedCategory);
    }

    const nodeIds = new Set(nodes.map((n) => n.id));

    const links = rawLinks.filter((l) => {
      const sId = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
      const tId = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
      return nodeIds.has(sId) && nodeIds.has(tId) && l.similarity >= minSimilarity;
    });

    return { filteredNodes: nodes, filteredLinks: links };
  }, [rawNodes, rawLinks, selectedCategory, minSimilarity]);

  // D3 Force Simulation Effect
  useEffect(() => {
    if (!svgRef.current || filteredNodes.length === 0) return;

    const width = dimensions.width;
    const height = dimensions.height;
    const svg = d3.select(svgRef.current);

    svg.selectAll('*').remove();

    // Create container group for zoom/pan
    const g = svg.append('g').attr('id', 'd3-graph-content');

    // Setup D3 Zoom
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.25, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);
    zoomBehaviorRef.current = zoom;

    // Deep clone data to avoid mutating original state
    const simNodes: GraphNode[] = filteredNodes.map((n) => ({ ...n }));
    const simLinks: GraphLink[] = filteredLinks.map((l) => ({ ...l }));

    // Define Force Simulation
    const simulation = d3
      .forceSimulation<GraphNode>(simNodes)
      .force(
        'link',
        d3
          .forceLink<GraphNode, GraphLink>(simLinks)
          .id((d) => d.id)
          .distance((d) => 100 * (1.15 - Math.min(0.9, d.similarity || 0.4)))
      )
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius(26))
      .force('x', d3.forceX(width / 2).strength(0.04))
      .force('y', d3.forceY(height / 2).strength(0.04));

    // Arrow markers / subtle gradient definitions
    const defs = svg.append('defs');
    const filter = defs.append('filter').attr('id', 'glow').attr('x', '-20%').attr('y', '-20%').attr('width', '140%').attr('height', '140%');
    filter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'blur');
    filter.append('feComposite').attr('in', 'SourceGraphic').attr('in2', 'blur').attr('operator', 'over');

    // Render Links
    const link = g
      .append('g')
      .attr('id', 'd3-links-layer')
      .selectAll<SVGLineElement, GraphLink>('line')
      .data(simLinks)
      .join('line')
      .attr('stroke', '#B7B0A8')
      .attr('stroke-opacity', (d) => Math.max(0.2, d.similarity * 0.9))
      .attr('stroke-width', (d) => Math.max(1, (d.similarity || 0.3) * 3.5))
      .attr('stroke-linecap', 'round')
      .style('cursor', 'pointer')
      .on('mouseenter', (_event, d) => {
        setHoveredLink(d);
      })
      .on('mouseleave', () => {
        setHoveredLink(null);
      });

    // Render Nodes
    const node = g
      .append('g')
      .attr('id', 'd3-nodes-layer')
      .selectAll<SVGGElement, GraphNode>('g')
      .data(simNodes)
      .join('g')
      .attr('class', 'node-group')
      .style('cursor', 'pointer')
      .call(
        d3
          .drag<SVGGElement, GraphNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    // Node Outer Ring (glow on selection or search match)
    node
      .append('circle')
      .attr('r', 18)
      .attr('fill', 'none')
      .attr('stroke', (d) => getCategoryColor(d.category).fill)
      .attr('stroke-width', 2)
      .attr('stroke-opacity', (d) => (selectedNode?.id === d.id ? 0.9 : 0.25))
      .attr('class', 'outer-pulse');

    // Node Core Circle
    node
      .append('circle')
      .attr('r', (d) => (selectedNode?.id === d.id ? 14 : 11))
      .attr('fill', (d) => getCategoryColor(d.category).fill)
      .attr('stroke', '#FFFFFF')
      .attr('stroke-width', 2)
      .attr('filter', (d) => (selectedNode?.id === d.id ? 'url(#glow)' : 'none'))
      .attr('class', 'core-circle transition-all');

    // Category initials inside node
    node
      .append('text')
      .text((d) => (d.category ? d.category.slice(0, 2).toUpperCase() : 'M'))
      .attr('text-anchor', 'middle')
      .attr('dy', '.35em')
      .attr('fill', '#FFFFFF')
      .attr('font-size', '9px')
      .attr('font-weight', '700')
      .attr('pointer-events', 'none')
      .attr('font-family', 'ui-monospace, monospace');

    // Node Text Label below circle
    node
      .append('text')
      .text((d) => {
        const clean = d.text.replace(/^(User preference:\s*|Project Context:\s*|Core Strategy:\s*)/i, '');
        return clean.length > 24 ? clean.slice(0, 22) + '…' : clean;
      })
      .attr('x', 0)
      .attr('y', 24)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('font-weight', '500')
      .attr('fill', '#3C3C3B')
      .attr('pointer-events', 'none')
      .style('paint-order', 'stroke')
      .style('stroke', '#FDFBF7')
      .style('stroke-width', '3px')
      .style('stroke-linejoin', 'round');

    // Interaction Events
    node
      .on('click', (_event, d) => {
        setSelectedNode(d);
        if (onSelectMemory) {
          onSelectMemory({
            id: d.id,
            text: d.text,
            metadata: {
              category: d.category,
              source: d.source,
              timestamp: d.timestamp,
            },
          });
        }
      })
      .on('mouseenter', (_event, d) => {
        setHoveredNode(d);
      })
      .on('mouseleave', () => {
        setHoveredNode(null);
      });

    // Tick Handler
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [filteredNodes, filteredLinks, dimensions, selectedNode, onSelectMemory]);

  // Update visual highlighting when hovered or selected or searched
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    const activeNodeId = hoveredNode?.id || selectedNode?.id;
    const query = searchQuery.toLowerCase().trim();

    // Highlighting links
    svg
      .select('#d3-links-layer')
      .selectAll<SVGLineElement, GraphLink>('line')
      .transition()
      .duration(150)
      .attr('stroke', (d) => {
        const sId = typeof d.source === 'object' ? (d.source as GraphNode).id : d.source;
        const tId = typeof d.target === 'object' ? (d.target as GraphNode).id : d.target;
        if (activeNodeId && (sId === activeNodeId || tId === activeNodeId)) {
          return '#588157';
        }
        return '#B7B0A8';
      })
      .attr('stroke-opacity', (d) => {
        const sId = typeof d.source === 'object' ? (d.source as GraphNode).id : d.source;
        const tId = typeof d.target === 'object' ? (d.target as GraphNode).id : d.target;
        if (activeNodeId) {
          return sId === activeNodeId || tId === activeNodeId ? 0.95 : 0.1;
        }
        return Math.max(0.2, d.similarity * 0.85);
      })
      .attr('stroke-width', (d) => {
        const sId = typeof d.source === 'object' ? (d.source as GraphNode).id : d.source;
        const tId = typeof d.target === 'object' ? (d.target as GraphNode).id : d.target;
        if (activeNodeId && (sId === activeNodeId || tId === activeNodeId)) {
          return Math.max(2, (d.similarity || 0.3) * 4.5);
        }
        return Math.max(1, (d.similarity || 0.3) * 3);
      });

    // Highlighting nodes
    svg
      .select('#d3-nodes-layer')
      .selectAll<SVGGElement, GraphNode>('.node-group')
      .transition()
      .duration(150)
      .style('opacity', (d) => {
        if (query) {
          const matches =
            d.text.toLowerCase().includes(query) ||
            d.category.toLowerCase().includes(query) ||
            d.source.toLowerCase().includes(query);
          return matches ? 1 : 0.2;
        }
        if (activeNodeId) {
          if (d.id === activeNodeId) return 1;
          // check if connected
          const isNeighbor = rawLinks.some((l) => {
            const sId = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
            const tId = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;
            return (
              l.similarity >= minSimilarity &&
              ((sId === activeNodeId && tId === d.id) || (tId === activeNodeId && sId === d.id))
            );
          });
          return isNeighbor ? 0.95 : 0.25;
        }
        return 1;
      });
  }, [hoveredNode, selectedNode, searchQuery, rawLinks, minSimilarity]);

  // Zoom control helpers
  const handleZoomIn = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 1.3);
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 0.75);
    }
  };

  const handleResetZoom = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current).transition().duration(350).call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
    }
  };

  // Connected neighbors for the currently selected node
  const connectedNeighbors = useMemo(() => {
    if (!selectedNode) return [];
    const neighbors: Array<{ node: GraphNode; similarity: number; distance: number }> = [];

    rawLinks.forEach((l) => {
      const sId = typeof l.source === 'object' ? (l.source as GraphNode).id : l.source;
      const tId = typeof l.target === 'object' ? (l.target as GraphNode).id : l.target;

      let otherId: string | null = null;
      if (sId === selectedNode.id) otherId = tId;
      else if (tId === selectedNode.id) otherId = sId;

      if (otherId) {
        const found = rawNodes.find((n) => n.id === otherId);
        if (found) {
          neighbors.push({
            node: found,
            similarity: l.similarity,
            distance: l.distance,
          });
        }
      }
    });

    neighbors.sort((a, b) => b.similarity - a.similarity);
    return neighbors;
  }, [selectedNode, rawLinks, rawNodes]);

  return (
    <div id="memory-semantic-graph-root" className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Top Controls Bar */}
      <div
        id="graph-controls-bar"
        className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white border-b border-[#E6E2DE] shrink-0"
      >
        {/* Left: View Mode Toggle & Category Filter */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Toggle */}
          <div className="flex items-center p-0.5 bg-[#F8F5F2] border border-[#E6E2DE] rounded-xl text-xs">
            <button
              id="view-mode-split-btn"
              onClick={() => setViewMode('split')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                viewMode === 'split' ? 'bg-white text-[#2D2D2A] shadow-xs font-semibold' : 'text-[#8A817C] hover:text-[#2D2D2A]'
              }`}
              title="Split View: Interactive Graph and Detail Inspector"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Split</span>
            </button>
            <button
              id="view-mode-graph-btn"
              onClick={() => setViewMode('graph')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                viewMode === 'graph' ? 'bg-white text-[#2D2D2A] shadow-xs font-semibold' : 'text-[#8A817C] hover:text-[#2D2D2A]'
              }`}
              title="Full Canvas Force Graph"
            >
              <Network className="w-3.5 h-3.5" />
              <span>Graph</span>
            </button>
            <button
              id="view-mode-list-btn"
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                viewMode === 'list' ? 'bg-white text-[#2D2D2A] shadow-xs font-semibold' : 'text-[#8A817C] hover:text-[#2D2D2A]'
              }`}
              title="Memory Stream List"
            >
              <List className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto py-0.5">
            <button
              id="cat-filter-all"
              onClick={() => setSelectedCategory('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-[#588157] text-white font-semibold'
                  : 'bg-[#F8F5F2] text-[#8A817C] hover:bg-[#EAE6E1]'
              }`}
            >
              All ({rawNodes.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                id={`cat-filter-${cat.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                  selectedCategory === cat
                    ? 'bg-[#3C3C3B] text-white font-semibold'
                    : 'bg-[#F8F5F2] text-[#8A817C] hover:bg-[#EAE6E1]'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: getCategoryColor(cat).fill }}
                />
                <span>{cat}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Search & Similarity Threshold Slider */}
        <div className="flex items-center gap-3 ml-auto flex-wrap">
          {/* Similarity Filter */}
          <div className="flex items-center gap-2 px-2.5 py-1 bg-[#F8F5F2] border border-[#E6E2DE] rounded-xl text-xs">
            <Sliders className="w-3 h-3 text-[#8A817C]" />
            <span className="text-[#8A817C] text-[11px]">Threshold:</span>
            <input
              id="similarity-slider"
              type="range"
              min="0.10"
              max="0.80"
              step="0.05"
              value={minSimilarity}
              onChange={(e) => setMinSimilarity(parseFloat(e.target.value))}
              className="w-16 h-1.5 accent-[#588157] cursor-pointer"
            />
            <span className="font-mono font-semibold text-[11px] text-[#2D2D2A] w-7 text-right">
              {minSimilarity.toFixed(2)}
            </span>
          </div>

          {/* Search Box */}
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-[#8A817C] absolute left-2.5 pointer-events-none" />
            <input
              id="graph-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Highlight concept..."
              className="pl-8 pr-7 py-1 bg-[#F8F5F2] border border-[#E6E2DE] rounded-xl text-xs w-36 sm:w-44 focus:outline-hidden focus:ring-1 focus:ring-[#A3B18A] focus:bg-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 text-[#8A817C] hover:text-[#2D2D2A]"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Loading / Error States */}
        {isLoading && (
          <div className="absolute inset-0 bg-[#FDFBF7]/80 z-20 flex flex-col items-center justify-center gap-2">
            <div className="w-6 h-6 border-2 border-[#588157] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-[#8A817C] font-medium">Computing semantic embeddings & relationships...</p>
          </div>
        )}

        {fetchError && (
          <div className="absolute inset-0 bg-[#FDFBF7] z-20 flex flex-col items-center justify-center p-6 text-center">
            <p className="text-xs text-red-700 font-semibold mb-2">Error: {fetchError}</p>
            <button
              onClick={refreshGraphData}
              className="px-3 py-1.5 bg-[#588157] text-white text-xs font-semibold rounded-lg hover:bg-[#466845]"
            >
              Retry
            </button>
          </div>
        )}

        {/* LIST ONLY VIEW */}
        {viewMode === 'list' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-[#E6E2DE]">
              <div>
                <h3 className="text-xs uppercase font-bold tracking-wider text-[#8A817C]">
                  Memory Stream ({filteredNodes.length} items)
                </h3>
                <p className="text-[11px] text-[#8A817C]">Ordered associative memory records</p>
              </div>
              {onNavigateToInject && (
                <button
                  onClick={onNavigateToInject}
                  className="px-3 py-1.5 bg-[#588157] text-white text-xs font-semibold rounded-xl hover:bg-[#466845] transition-colors flex items-center gap-1"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>Add Memory</span>
                </button>
              )}
            </div>

            {filteredNodes.length === 0 ? (
              <div className="text-center py-16 text-xs text-[#8A817C]">
                No memories found matching the current filters.
              </div>
            ) : (
              filteredNodes.map((item) => {
                const col = getCategoryColor(item.category);
                const isSelected = selectedNode?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedNode(item)}
                    className={`p-4 bg-white border rounded-2xl transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#588157] shadow-sm ring-1 ring-[#588157]'
                        : 'border-[#E6E2DE] hover:border-[#D4A373] shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${col.bg} ${col.text}`}>
                          {item.category}
                        </span>
                        <span className="text-[10px] font-mono text-[#8A817C]">ID: {item.id}</span>
                      </div>
                      <span className="text-[10px] text-[#8A817C] font-mono">Source: {item.source}</span>
                    </div>
                    <p className="text-xs text-[#2D2D2A] leading-relaxed font-medium">{item.text}</p>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* GRAPH / SPLIT VIEW */}
        {(viewMode === 'graph' || viewMode === 'split') && (
          <div className="flex-1 flex overflow-hidden">
            {/* SVG Force Canvas */}
            <div ref={containerRef} className="flex-1 relative bg-[#FDFBF7] overflow-hidden">
              <svg
                id="memory-d3-graph-svg"
                ref={svgRef}
                className="w-full h-full block select-none"
                style={{ cursor: 'grab' }}
              />

              {/* Floating Graph Overlay Tools (Zoom, Legend, Node Count) */}
              <div
                id="graph-floating-tools"
                className="absolute bottom-3 left-3 flex items-center gap-2 p-1 bg-white/90 backdrop-blur-xs border border-[#E6E2DE] rounded-xl shadow-xs"
              >
                <button
                  id="graph-zoom-in-btn"
                  onClick={handleZoomIn}
                  className="p-1.5 text-[#3C3C3B] hover:bg-[#F8F5F2] rounded-lg transition-colors cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  id="graph-zoom-out-btn"
                  onClick={handleZoomOut}
                  className="p-1.5 text-[#3C3C3B] hover:bg-[#F8F5F2] rounded-lg transition-colors cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  id="graph-reset-zoom-btn"
                  onClick={handleResetZoom}
                  className="p-1.5 text-[#3C3C3B] hover:bg-[#F8F5F2] rounded-lg transition-colors cursor-pointer"
                  title="Reset View"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <div className="h-4 w-px bg-[#E6E2DE] mx-0.5" />
                <button
                  id="graph-reheat-btn"
                  onClick={refreshGraphData}
                  className="px-2 py-1 text-[10px] font-semibold text-[#588157] hover:bg-[#58815712] rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                  title="Recalculate Embeddings and Graph"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Sync</span>
                </button>
              </div>

              {/* Top-Right Badge: Active Node & Link Count */}
              <div className="absolute top-3 right-3 flex items-center gap-2 pointer-events-none">
                <span className="px-2.5 py-1 bg-white/90 backdrop-blur-xs border border-[#E6E2DE] rounded-lg text-[10px] font-mono text-[#8A817C] shadow-2xs">
                  Nodes: <strong className="text-[#2D2D2A]">{filteredNodes.length}</strong> | Links:{' '}
                  <strong className="text-[#2D2D2A]">{filteredLinks.length}</strong>
                </span>
              </div>

              {/* Hover Tooltip for Links */}
              {hoveredLink && (
                <div className="absolute top-3 left-3 bg-[#2D2D2A] text-white text-[11px] font-mono px-3 py-1.5 rounded-lg shadow-md pointer-events-none flex items-center gap-2 z-10 animate-fade-in">
                  <Network className="w-3 h-3 text-[#D4A373]" />
                  <span>
                    Cosine Similarity:{' '}
                    <strong className="text-[#588157]">
                      {((hoveredLink.similarity || 0) * 100).toFixed(1)}%
                    </strong>{' '}
                    (Distance: {hoveredLink.distance})
                  </span>
                </div>
              )}

              {/* Hover Tooltip for Nodes */}
              {hoveredNode && !selectedNode && (
                <div className="absolute bottom-14 left-3 max-w-xs bg-white border border-[#E6E2DE] text-[#2D2D2A] text-xs p-2.5 rounded-xl shadow-md pointer-events-none z-10">
                  <span className="text-[10px] font-mono text-[#8A817C] block mb-0.5">
                    {hoveredNode.category} • {hoveredNode.source}
                  </span>
                  <p className="line-clamp-2 leading-relaxed font-medium">{hoveredNode.text}</p>
                </div>
              )}
            </div>

            {/* Split View Right Side: Detail Inspector */}
            {viewMode === 'split' && (
              <aside
                id="graph-detail-inspector"
                className="w-80 sm:w-96 border-l border-[#E6E2DE] bg-white flex flex-col overflow-hidden shrink-0 shadow-xs"
              >
                <div className="p-3.5 border-b border-[#E6E2DE] flex items-center justify-between bg-[#F8F5F2]">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-[#588157]" />
                    <h3 className="text-xs uppercase font-bold tracking-wider text-[#2D2D2A]">
                      Memory Inspector
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-[#8A817C]">Associative Node</span>
                </div>

                {selectedNode ? (
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Header: Category & ID */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span
                          className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                            getCategoryColor(selectedNode.category).bg
                          } ${getCategoryColor(selectedNode.category).text}`}
                        >
                          {selectedNode.category}
                        </span>
                        <span className="text-[10px] font-mono text-[#8A817C]">ID: {selectedNode.id}</span>
                      </div>
                      <p className="text-xs font-semibold text-[#2D2D2A] leading-relaxed bg-[#FDFBF7] p-3 rounded-xl border border-[#E6E2DE]">
                        {selectedNode.text}
                      </p>
                    </div>

                    {/* Meta details */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                      <div className="p-2 bg-[#F8F5F2] rounded-lg border border-[#E6E2DE]">
                        <span className="text-[#8A817C] block text-[9px] uppercase font-bold">Source Tag</span>
                        <span className="text-[#2D2D2A] font-medium truncate block">
                          {selectedNode.source || 'Direct'}
                        </span>
                      </div>
                      <div className="p-2 bg-[#F8F5F2] rounded-lg border border-[#E6E2DE]">
                        <span className="text-[#8A817C] block text-[9px] uppercase font-bold">Connections</span>
                        <span className="text-[#588157] font-bold">{connectedNeighbors.length} relations</span>
                      </div>
                    </div>

                    {/* Quick Action: Query in Chat */}
                    {onQueryInChat && (
                      <button
                        id="inspector-query-chat-btn"
                        onClick={() => onQueryInChat(selectedNode.text)}
                        className="w-full py-2 bg-[#588157] hover:bg-[#466845] text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Query Agent with this Context</span>
                      </button>
                    )}

                    {/* Connected Semantic Relations */}
                    <div className="space-y-2 pt-2 border-t border-[#E6E2DE]">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[11px] uppercase font-bold tracking-wider text-[#8A817C]">
                          Semantic Neighbors
                        </h4>
                        <span className="text-[10px] font-mono text-[#8A817C]">
                          {connectedNeighbors.length} links
                        </span>
                      </div>

                      {connectedNeighbors.length === 0 ? (
                        <p className="text-xs text-[#8A817C] italic py-2">
                          No strong semantic relations above threshold ({minSimilarity.toFixed(2)}). Lower the threshold slider to expand associations.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {connectedNeighbors.map(({ node: neighbor, similarity, distance }) => {
                            const nCol = getCategoryColor(neighbor.category);
                            return (
                              <div
                                key={neighbor.id}
                                onClick={() => setSelectedNode(neighbor)}
                                className="p-2.5 bg-[#FDFBF7] hover:bg-[#F8F5F2] border border-[#E6E2DE] hover:border-[#D4A373] rounded-xl transition-all cursor-pointer space-y-1.5"
                              >
                                <div className="flex items-center justify-between text-[10px]">
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${nCol.bg} ${nCol.text}`}>
                                    {neighbor.category}
                                  </span>
                                  <div className="flex items-center gap-1.5 font-mono">
                                    <span className="text-[#588157] font-bold">
                                      {(similarity * 100).toFixed(0)}% sim
                                    </span>
                                    <span className="text-[#8A817C]">d={distance}</span>
                                  </div>
                                </div>
                                <p className="text-xs text-[#2D2D2A] line-clamp-2 leading-relaxed">
                                  {neighbor.text}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-xs text-[#8A817C]">
                    <Network className="w-8 h-8 text-[#D4A373] opacity-40 mb-2" />
                    <p className="font-medium">Click any node on the canvas to inspect its semantic neighbors and vector attributes.</p>
                  </div>
                )}
              </aside>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
