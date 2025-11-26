const canvas = document.getElementById('canvas-container');
const nodeLayer = document.getElementById('node-layer');
const svgConnections = document.getElementById('connections');
let nodes = [];
let connections = [];
let draggedNode = null;
let dragOffset = { x: 0, y: 0 };
let activeConnection = null;

// Basic Node Factory
function createNode(type, x, y) {
    const node = document.createElement('div');
    node.classList.add('node');
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    node.id = `node-${Date.now()}`;
    node.dataset.type = type;

    let title = '';
    let content = '';
    let inputs = [];
    let outputs = [];

    if (type === 'palette') {
        title = 'Color Palette Generator';
        outputs = ['palette'];
        content = `
      <div class="control-row">
        <span>Base Color</span>
        <input type="color" value="#3b82f6" class="base-color">
      </div>
      <div class="control-row">
        <span>Steps</span>
        <input type="number" value="5" min="3" max="10" class="steps">
      </div>
      <div class="control-row">
        <span>Mode</span>
        <select class="mode">
          <option value="oklch">OKLCH</option>
          <option value="rgb">RGB</option>
          <option value="hsl">HSL</option>
        </select>
      </div>
      <div class="visual-output color-swatch-row"></div>
    `;
    } else if (type === 'type-scale') {
        title = 'Type Scale Generator';
        outputs = ['scale'];
        content = `
      <div class="control-row">
        <span>Base Size (px)</span>
        <input type="number" value="16" class="base-size">
      </div>
      <div class="control-row">
        <span>Ratio</span>
        <select class="ratio">
          <option value="1.25">1.25 (Major Third)</option>
          <option value="1.414">1.414 (Augmented Fourth)</option>
          <option value="1.5">1.5 (Perfect Fifth)</option>
          <option value="1.618">1.618 (Golden Ratio)</option>
        </select>
      </div>
      <div class="control-row">
        <span>Steps</span>
        <input type="number" value="5" min="3" max="8" class="steps">
      </div>
      <div class="visual-output type-scale-list"></div>
    `;
    } else if (type === 'export') {
        title = 'Export to JSON';
        inputs = ['data'];
        content = `
      <div class="control-row">
        <span>Variable Name</span>
        <input type="text" value="design-tokens" class="var-name">
      </div>
      <button class="export-btn">Download JSON</button>
      <div class="json-preview" style="font-size: 0.7rem; color: #666; margin-top: 0.5rem; max-height: 100px; overflow: hidden;">Waiting for data...</div>
    `;
    }

    node.innerHTML = `
    <div class="node-header">${title}</div>
    <div class="node-body">
      ${inputs.map(i => `<div class="socket-row"><div class="socket input" title="${i}"></div><span>${i}</span></div>`).join('')}
      ${content}
      ${outputs.map(o => `<div class="socket-row"><span>${o}</span><div class="socket output" title="${o}"></div></div>`).join('')}
    </div>
  `;

    // Drag Logic
    const header = node.querySelector('.node-header');
    header.addEventListener('mousedown', (e) => {
        draggedNode = node;
        dragOffset.x = e.clientX - node.offsetLeft;
        dragOffset.y = e.clientY - node.offsetTop;
    });

    // Export Logic
    if (type === 'export') {
        node.querySelector('.export-btn').addEventListener('click', () => exportData(node));
    }

    nodeLayer.appendChild(node);
    nodes.push(node);

    // Initial Process
    processGraph();
}

// Canvas Drag & Drop
canvas.addEventListener('dragover', (e) => e.preventDefault());
canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('type');
    if (type) {
        createNode(type, e.offsetX, e.offsetY);
    }
});

// Sidebar Drag Start
document.querySelectorAll('.node-template').forEach(t => {
    t.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('type', e.target.dataset.type);
    });
});

// Connection Logic
function updateConnections() {
    while (svgConnections.firstChild) {
        svgConnections.removeChild(svgConnections.firstChild);
    }

    connections.forEach(conn => {
        drawCurve(conn.outputNode, conn.outputSocket, conn.inputNode, conn.inputSocket);
    });

    if (activeConnection) {
        drawActiveCurve(activeConnection.startNode, activeConnection.startSocket, activeConnection.currentX, activeConnection.currentY);
    }
}

function drawCurve(nodeA, socketA, nodeB, socketB) {
    const rectA = nodeA.getBoundingClientRect();
    const rectB = nodeB.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();

    const socketElA = nodeA.querySelector(`.socket.output[title="${socketA}"]`);
    const socketElB = nodeB.querySelector(`.socket.input[title="${socketB}"]`);

    if (!socketElA || !socketElB) return;

    const posA = {
        x: rectA.left - canvasRect.left + socketElA.offsetLeft + 7,
        y: rectA.top - canvasRect.top + socketElA.offsetTop + 7
    };

    const posB = {
        x: rectB.left - canvasRect.left + socketElB.offsetLeft + 7,
        y: rectB.top - canvasRect.top + socketElB.offsetTop + 7
    };

    createPath(posA.x, posA.y, posB.x, posB.y);
}

function drawActiveCurve(node, socket, x, y) {
    const rect = node.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const socketEl = node.querySelector(`.socket.output[title="${socket}"]`);

    if (!socketEl) return;

    const startX = rect.left - canvasRect.left + socketEl.offsetLeft + 7;
    const startY = rect.top - canvasRect.top + socketEl.offsetTop + 7;

    createPath(startX, startY, x, y);
}

function createPath(x1, y1, x2, y2) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const curvature = 0.5;
    const hx1 = x1 + Math.abs(x2 - x1) * curvature;
    const hx2 = x2 - Math.abs(x2 - x1) * curvature;

    path.setAttribute('d', `M ${x1} ${y1} C ${hx1} ${y1} ${hx2} ${y2} ${x2} ${y2}`);
    path.setAttribute('stroke', '#777');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('fill', 'none');

    svgConnections.appendChild(path);
}

// Socket Event Listeners
nodeLayer.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('socket') && e.target.classList.contains('output')) {
        e.stopPropagation();
        const node = e.target.closest('.node');
        const socketName = e.target.title;

        activeConnection = {
            startNode: node,
            startSocket: socketName,
            currentX: 0,
            currentY: 0
        };
    }
});

nodeLayer.addEventListener('mouseup', (e) => {
    if (activeConnection && e.target.classList.contains('socket') && e.target.classList.contains('input')) {
        const node = e.target.closest('.node');
        const socketName = e.target.title;

        // Replace existing connection
        const existingConnIndex = connections.findIndex(c => c.inputNode === node && c.inputSocket === socketName);
        if (existingConnIndex !== -1) {
            connections.splice(existingConnIndex, 1);
        }

        connections.push({
            outputNode: activeConnection.startNode,
            outputSocket: activeConnection.startSocket,
            inputNode: node,
            inputSocket: socketName
        });

        activeConnection = null;
        updateConnections();
        processGraph();
    } else if (activeConnection) {
        activeConnection = null;
        updateConnections();
    }
});

nodeLayer.addEventListener('contextmenu', (e) => {
    if (e.target.classList.contains('socket') && e.target.classList.contains('input')) {
        e.preventDefault();
        const node = e.target.closest('.node');
        const socketName = e.target.title;

        const existingConnIndex = connections.findIndex(c => c.inputNode === node && c.inputSocket === socketName);
        if (existingConnIndex !== -1) {
            connections.splice(existingConnIndex, 1);
            updateConnections();
            processGraph();
        }
    }
});

document.addEventListener('mousemove', (e) => {
    const canvasRect = canvas.getBoundingClientRect();

    if (draggedNode) {
        draggedNode.style.left = `${e.clientX - dragOffset.x}px`;
        draggedNode.style.top = `${e.clientY - dragOffset.y}px`;
        updateConnections();
    }

    if (activeConnection) {
        activeConnection.currentX = e.clientX - canvasRect.left;
        activeConnection.currentY = e.clientY - canvasRect.top;
        updateConnections();
    }
});

document.addEventListener('mouseup', () => {
    draggedNode = null;
    if (activeConnection) {
        activeConnection = null;
        updateConnections();
    }
});

// --- Logic Engine ---

function processGraph() {
    nodes.forEach(node => {
        const type = node.dataset.type;

        if (type === 'palette') {
            updatePaletteNode(node);
        } else if (type === 'type-scale') {
            updateTypeScaleNode(node);
        } else if (type === 'export') {
            updateExportNode(node);
        }
    });
}

function updatePaletteNode(node) {
    const baseColor = node.querySelector('.base-color').value;
    const steps = parseInt(node.querySelector('.steps').value);
    const mode = node.querySelector('.mode').value;
    const visualOutput = node.querySelector('.visual-output');

    // Generate Palette using culori
    // We'll generate a scale from white to the base color to black, or just tints/shades
    // Let's do a simple tint/shade scale: Lighter -> Base -> Darker

    const palette = [];
    const interpolator = culori.interpolate(['white', baseColor, 'black'], { mode: mode });

    visualOutput.innerHTML = '';

    for (let i = 0; i < steps; i++) {
        // Map i to 0.1 - 0.9 range to avoid pure white/black
        const t = 0.1 + (i / (steps - 1)) * 0.8;
        const color = culori.formatHex(interpolator(t));
        palette.push(color);

        const swatch = document.createElement('div');
        swatch.classList.add('swatch');
        swatch.style.backgroundColor = color;
        swatch.title = color;
        visualOutput.appendChild(swatch);
    }

    node.dataset.value = JSON.stringify(palette);

    // Propagate to connected nodes
    triggerDownstream(node);
}

function updateTypeScaleNode(node) {
    const baseSize = parseInt(node.querySelector('.base-size').value);
    const ratio = parseFloat(node.querySelector('.ratio').value);
    const steps = parseInt(node.querySelector('.steps').value);
    const visualOutput = node.querySelector('.visual-output');

    const scale = [];
    visualOutput.innerHTML = '';

    for (let i = 0; i < steps; i++) {
        const size = Math.round(baseSize * Math.pow(ratio, i));
        scale.push(size + 'px');

        const step = document.createElement('div');
        step.classList.add('type-step');
        step.innerHTML = `
      <span class="type-preview" style="font-size: ${Math.min(size, 24)}px">Ag</span>
      <span class="type-info">${size}px</span>
    `;
        visualOutput.appendChild(step);
    }

    node.dataset.value = JSON.stringify(scale);
    triggerDownstream(node);
}

function updateExportNode(node) {
    const inputConn = connections.find(c => c.inputNode === node);
    const preview = node.querySelector('.json-preview');

    if (inputConn) {
        const sourceNode = inputConn.outputNode;
        const data = JSON.parse(sourceNode.dataset.value || '[]');
        preview.innerText = JSON.stringify(data, null, 2);
        node.dataset.exportData = JSON.stringify(data);
    } else {
        preview.innerText = "No input connected";
        node.dataset.exportData = '';
    }
}

function triggerDownstream(node) {
    // Find nodes connected to this node's output
    const downstreamConns = connections.filter(c => c.outputNode === node);
    downstreamConns.forEach(c => {
        if (c.inputNode.dataset.type === 'export') {
            updateExportNode(c.inputNode);
        }
    });
}

function exportData(node) {
    const dataStr = node.dataset.exportData;
    if (!dataStr) return;

    const name = node.querySelector('.var-name').value;
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    link.setAttribute('download', name + '.json');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Event Listeners for Controls
nodeLayer.addEventListener('input', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
        const node = e.target.closest('.node');
        if (node.dataset.type === 'palette') updatePaletteNode(node);
        if (node.dataset.type === 'type-scale') updateTypeScaleNode(node);
    }
});

// Initial Nodes
createNode('palette', 50, 50);
createNode('type-scale', 50, 350);
createNode('export', 400, 200);
