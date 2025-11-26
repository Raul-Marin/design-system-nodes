const canvas = document.getElementById('canvas-container');
const nodeLayer = document.getElementById('node-layer');
const svgConnections = document.getElementById('connections');
let nodes = [];
let connections = [];
let draggedNode = null;
let dragOffset = { x: 0, y: 0 };

// Basic Node Factory
function createNode(type, x, y) {
    const node = document.createElement('div');
    node.classList.add('node');
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    node.id = `node-${Date.now()}`;

    let title = type;
    let inputs = [];
    let outputs = [];
    let content = '';

    if (type === 'color') {
        title = 'Color Input';
        outputs = ['color'];
        content = '<input type="color" value="#3b82f6">';
    } else if (type === 'number') {
        title = 'Number Input';
        outputs = ['value'];
        content = '<input type="number" value="16" style="width: 60px;"> <select style="width: 60px;"><option value="px">px</option><option value="rem">rem</option><option value="">none</option></select>';
    } else if (type === 'font') {
        title = 'Font Input';
        outputs = ['font'];
        content = '<select><option value="Inter, sans-serif">Inter</option><option value="JetBrains Mono, monospace">Mono</option><option value="serif">Serif</option></select>';
    } else if (type === 'mix') {
        title = 'Mix Colors';
        inputs = ['A', 'B'];
        outputs = ['result'];
    } else if (type === 'output') {
        title = 'Output Token';
        inputs = ['value'];
        content = `
      <select>
        <option value="Primary Color">Primary Color</option>
        <option value="Border Radius">Border Radius</option>
        <option value="Border Width">Border Width</option>
        <option value="Padding">Padding</option>
        <option value="Gap">Gap</option>
        <option value="Font Family">Font Family</option>
      </select>
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

    nodeLayer.appendChild(node);
    nodes.push(node);
}

// Canvas Drag & Drop (Creating Nodes)
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
let activeConnection = null;

function updateConnections() {
    // Clear existing lines
    while (svgConnections.firstChild) {
        svgConnections.removeChild(svgConnections.firstChild);
    }

    // Draw permanent connections
    connections.forEach(conn => {
        drawCurve(conn.outputNode, conn.outputSocket, conn.inputNode, conn.inputSocket);
    });

    // Draw active drag connection
    if (activeConnection) {
        drawActiveCurve(activeConnection.startNode, activeConnection.startSocket, activeConnection.currentX, activeConnection.currentY);
    }
}

function drawCurve(nodeA, socketA, nodeB, socketB) {
    // Calculate positions relative to canvas
    const rectA = nodeA.getBoundingClientRect();
    const rectB = nodeB.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();

    // Find socket elements
    const socketElA = nodeA.querySelector(`.socket.output[title="${socketA}"]`);
    const socketElB = nodeB.querySelector(`.socket.input[title="${socketB}"]`);

    if (!socketElA || !socketElB) return;

    const posA = {
        x: rectA.left - canvasRect.left + socketElA.offsetLeft + 6,
        y: rectA.top - canvasRect.top + socketElA.offsetTop + 6
    };

    const posB = {
        x: rectB.left - canvasRect.left + socketElB.offsetLeft + 6,
        y: rectB.top - canvasRect.top + socketElB.offsetTop + 6
    };

    createPath(posA.x, posA.y, posB.x, posB.y);
}

function drawActiveCurve(node, socket, x, y) {
    const rect = node.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const socketEl = node.querySelector(`.socket.output[title="${socket}"]`);

    if (!socketEl) return;

    const startX = rect.left - canvasRect.left + socketEl.offsetLeft + 6;
    const startY = rect.top - canvasRect.top + socketEl.offsetTop + 6;

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

// Socket Event Listeners (Delegation)
nodeLayer.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('socket') && e.target.classList.contains('output')) {
        e.stopPropagation(); // Prevent node drag
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

        // Create connection
        connections.push({
            outputNode: activeConnection.startNode,
            outputSocket: activeConnection.startSocket,
            inputNode: node,
            inputSocket: socketName
        });

        activeConnection = null;
        updateConnections();
        processGraph(); // Trigger update
    } else if (activeConnection) {
        activeConnection = null;
        updateConnections();
    }
});

// Global Mouse Move (Dragging Nodes & Connections)
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

// Process Graph
function processGraph() {
    const outputNodes = nodes.filter(n => n.querySelector('.node-header').innerText === 'Output Token');

    const tokenList = document.getElementById('token-list');
    tokenList.innerHTML = '';

    outputNodes.forEach(outNode => {
        const inputSocket = outNode.querySelector('.socket.input');
        const source = findSource(outNode, 'value');

        if (source) {
            const value = calculateValue(source.node, source.socket);
            const tokenType = outNode.querySelector('select').value;

            applyToken(tokenType, value);

            // Update Token List
            const div = document.createElement('div');
            div.style.padding = '0.5rem';
            div.style.borderBottom = '1px solid #333';
            div.style.fontSize = '0.8rem';
            div.innerHTML = `<strong style="color:#3b82f6">${tokenType}</strong>: ${value}`;
            tokenList.appendChild(div);
        }
    });
}

function findSource(node, inputName) {
    const conn = connections.find(c => c.inputNode === node && c.inputSocket === inputName);
    if (conn) {
        return { node: conn.outputNode, socket: conn.outputSocket };
    }
    return null;
}

function calculateValue(node, socketName) {
    const type = node.querySelector('.node-header').innerText;

    if (type === 'Color Input') {
        return node.querySelector('input').value;
    } else if (type === 'Number Input') {
        const val = node.querySelector('input').value;
        const unit = node.querySelectorAll('select')[0].value;
        return val + unit;
    } else if (type === 'Font Input') {
        return node.querySelector('select').value;
    } else if (type === 'Mix Colors') {
        const sourceA = findSource(node, 'A');
        const sourceB = findSource(node, 'B');

        const colorA = sourceA ? calculateValue(sourceA.node, sourceA.socket) : '#000000';
        const colorB = sourceB ? calculateValue(sourceB.node, sourceB.socket) : '#ffffff';

        return mixColors(colorA, colorB, 0.5);
    }

    return null;
}

function applyToken(type, value) {
    const activeComponentId = document.getElementById('component-select').value;
    const container = document.getElementById(`preview-${activeComponentId}`);

    // Reset styles first? No, we want cumulative updates from multiple nodes.
    // But we need to target specific elements based on component type.

    let target = container; // Default to container (e.g. Card)
    if (activeComponentId === 'button') target = container.querySelector('button');
    if (activeComponentId === 'input') target = container.querySelector('input');

    // Special case for Card inner elements
    const cardBtn = container.querySelector('button');
    const cardTitle = container.querySelector('h2');

    if (type === 'Primary Color') {
        if (activeComponentId === 'card') {
            cardBtn.style.backgroundColor = value;
            cardTitle.style.color = value;
        } else if (activeComponentId === 'button') {
            target.style.backgroundColor = value;
        } else if (activeComponentId === 'input') {
            target.style.borderColor = value;
        }
    } else if (type === 'Border Radius') {
        target.style.borderRadius = value;
        if (activeComponentId === 'card') cardBtn.style.borderRadius = value;
    } else if (type === 'Border Width') {
        target.style.borderWidth = value;
        target.style.borderStyle = 'solid';
    } else if (type === 'Padding') {
        target.style.padding = value;
    } else if (type === 'Gap') {
        if (activeComponentId === 'input') {
            container.querySelector('.input-group').style.gap = value;
        } else {
            target.style.gap = value;
        }
    } else if (type === 'Font Family') {
        target.style.fontFamily = value;
        if (activeComponentId === 'card') {
            container.style.fontFamily = value;
        }
    }
}

// Component Selector Logic
document.getElementById('component-select').addEventListener('change', (e) => {
    document.querySelectorAll('.preview-component').forEach(el => el.classList.remove('active'));
    document.getElementById(`preview-${e.target.value}`).classList.add('active');
    processGraph(); // Re-apply tokens to new component
});

// Simple Color Mixer
function mixColors(hex1, hex2, weight) {
    function d2h(d) { return d.toString(16); }
    function h2d(h) { return parseInt(h, 16); }

    weight = (typeof (weight) !== 'undefined') ? weight : 0.5;

    let color = "#";

    for (let i = 1; i <= 6; i += 2) {
        let v1 = h2d(hex1.substr(i, 2));
        let v2 = h2d(hex2.substr(i, 2));
        let val = d2h(Math.floor(v2 + (v1 - v2) * weight));
        while (val.length < 2) { val = '0' + val; }
        color += val;
    }

    return color;
}

// Trigger process on input change
nodeLayer.addEventListener('input', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
        processGraph();
    }
});

// Initial Nodes
createNode('color', 50, 50);
createNode('output', 400, 100);
