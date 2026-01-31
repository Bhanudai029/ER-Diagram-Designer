const canvas = document.getElementById('canvas');
const connectionsSvg = document.getElementById('connections');
const labelInput = document.getElementById('prop-label');
const typeReadout = document.getElementById('prop-type');
const connectToggle = document.getElementById('connect-toggle');
const deleteBtn = document.getElementById('delete-selected');
const clearBtn = document.getElementById('clear-canvas');
const templateButtons = document.querySelectorAll('.template-btn');
const paletteItems = document.querySelectorAll('.palette-item');
const canvasHint = document.querySelector('.canvas-hint');
const contextMenu = document.getElementById('context-menu');
const menuEdit = document.getElementById('menu-edit');
const menuDuplicate = document.getElementById('menu-duplicate');
const menuDelete = document.getElementById('menu-delete');

const state = {
  elements: new Map(),
  connections: [],
  selectedId: null,
  connectMode: false,
  pendingConnectionFrom: null,
  dragging: null,
  isDraggingConnection: false,
  connectionDragPos: { x: 0, y: 0 },
  undoStack: [],
  redoStack: [],
};

let idCounter = 1;
let connectionCounter = 1;

const typeLabels = {
  'entity': 'Entity',
  'weak-entity': 'Weak Entity',
  'relationship': 'Relationship',
  'identifying-relationship': 'Identifying Relationship',
  'attribute': 'Attribute',
  'key-attribute': 'Key Attribute',
  'multivalued-attribute': 'Multivalued Attribute',
  'derived-attribute': 'Derived Attribute',
  'isa': 'ISA',
  'associative-entity': 'Associative Entity',
};

const templates = {
  library: {
    elements: [
      { key: 'Book', type: 'entity', label: 'Book', x: 120, y: 140 },
      { key: 'Author', type: 'entity', label: 'Author', x: 420, y: 140 },
      { key: 'Writes', type: 'relationship', label: 'Writes', x: 280, y: 120 },
      { key: 'ISBN', type: 'key-attribute', label: 'ISBN', x: 80, y: 40 },
      { key: 'Title', type: 'attribute', label: 'Title', x: 160, y: 40 },
      { key: 'Borrower', type: 'entity', label: 'Borrower', x: 120, y: 360 },
      { key: 'Loans', type: 'relationship', label: 'Loans', x: 280, y: 340 },
      { key: 'LoanDate', type: 'attribute', label: 'Loan Date', x: 380, y: 280 },
      { key: 'MemberID', type: 'key-attribute', label: 'Member ID', x: 80, y: 280 },
    ],
    connections: [
      ['Book', 'Writes'],
      ['Author', 'Writes'],
      ['Book', 'ISBN'],
      ['Book', 'Title'],
      ['Borrower', 'Loans'],
      ['Book', 'Loans'],
      ['Loans', 'LoanDate'],
      ['Borrower', 'MemberID'],
    ],
  },
  ecommerce: {
    elements: [
      { key: 'Customer', type: 'entity', label: 'Customer', x: 110, y: 120 },
      { key: 'Order', type: 'entity', label: 'Order', x: 380, y: 120 },
      { key: 'Places', type: 'relationship', label: 'Places', x: 250, y: 90 },
      { key: 'Product', type: 'entity', label: 'Product', x: 380, y: 360 },
      { key: 'OrderLine', type: 'associative-entity', label: 'Order Line', x: 250, y: 300 },
      { key: 'Quantity', type: 'attribute', label: 'Quantity', x: 140, y: 280 },
      { key: 'Price', type: 'attribute', label: 'Price', x: 500, y: 300 },
      { key: 'OrderID', type: 'key-attribute', label: 'Order ID', x: 420, y: 20 },
      { key: 'Email', type: 'attribute', label: 'Email', x: 60, y: 20 },
    ],
    connections: [
      ['Customer', 'Places'],
      ['Order', 'Places'],
      ['Order', 'OrderID'],
      ['Customer', 'Email'],
      ['Order', 'OrderLine'],
      ['Product', 'OrderLine'],
      ['OrderLine', 'Quantity'],
      ['OrderLine', 'Price'],
    ],
  },
  university: {
    elements: [
      { key: 'Student', type: 'entity', label: 'Student', x: 110, y: 120 },
      { key: 'Course', type: 'entity', label: 'Course', x: 420, y: 120 },
      { key: 'Enrolls', type: 'relationship', label: 'Enrolls', x: 280, y: 100 },
      { key: 'Instructor', type: 'entity', label: 'Instructor', x: 420, y: 340 },
      { key: 'Teaches', type: 'relationship', label: 'Teaches', x: 300, y: 300 },
      { key: 'Grade', type: 'derived-attribute', label: 'Grade', x: 140, y: 260 },
      { key: 'StudentID', type: 'key-attribute', label: 'Student ID', x: 70, y: 20 },
      { key: 'CourseCode', type: 'key-attribute', label: 'Course Code', x: 420, y: 20 },
    ],
    connections: [
      ['Student', 'Enrolls'],
      ['Course', 'Enrolls'],
      ['Enrolls', 'Grade'],
      ['Student', 'StudentID'],
      ['Course', 'CourseCode'],
      ['Instructor', 'Teaches'],
      ['Course', 'Teaches'],
    ],
  },
};

function setSelected(id) {
  if (state.selectedId && state.elements.has(state.selectedId)) {
    state.elements.get(state.selectedId).el.classList.remove('selected');
  }

  state.selectedId = id;

  if (id && state.elements.has(id)) {
    const item = state.elements.get(id);
    item.el.classList.add('selected');
    labelInput.value = item.label;
    labelInput.disabled = false;
    labelInput.focus();
    labelInput.select();
    typeReadout.textContent = typeLabels[item.type] || item.type;
  } else {
    labelInput.value = '';
    labelInput.disabled = true;
    typeReadout.textContent = 'None';
  }
}

function saveState() {
  const currentState = {
    elements: Array.from(state.elements).map(([id, data]) => ({
      id,
      type: data.type,
      x: data.x,
      y: data.y,
      label: data.label
    })),
    connections: JSON.parse(JSON.stringify(state.connections))
  };

  // Only save if it's different from the last state
  const lastState = state.undoStack[state.undoStack.length - 1];
  if (lastState && JSON.stringify(lastState) === JSON.stringify(currentState)) return;

  state.undoStack.push(currentState);
  if (state.undoStack.length > 50) state.undoStack.shift();
  state.redoStack = []; // Clear redo on new action
}

function undo() {
  if (state.undoStack.length <= 1) return;
  const current = state.undoStack.pop();
  state.redoStack.push(current);
  const previous = state.undoStack[state.undoStack.length - 1];
  applySnapshot(previous);
}

function redo() {
  if (state.redoStack.length === 0) return;
  const next = state.redoStack.pop();
  state.undoStack.push(next);
  applySnapshot(next);
}

function applySnapshot(snapshot) {
  // Clear Current
  state.elements.forEach(item => item.el.remove());
  state.elements.clear();
  state.connections = [];

  // Re-create from snapshot
  snapshot.elements.forEach(item => {
    createElement(item.type, item.x, item.y, item.label, true);
  });
  state.connections = JSON.parse(JSON.stringify(snapshot.connections));

  renderConnections();
  updateCanvasHint();
}

function createElement(type, x, y, label, isRestoring = false) {
  const id = `node-${idCounter++}`;
  const el = document.createElement('div');
  el.className = `er-node shape-${type}`;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.dataset.id = id;

  const labelEl = document.createElement('span');
  labelEl.className = 'label';
  labelEl.textContent = (label !== undefined) ? label : (typeLabels[type] || 'Element');
  el.appendChild(labelEl);

  // Add connection anchors
  ['top', 'bottom', 'left', 'right'].forEach(pos => {
    const anchor = document.createElement('div');
    anchor.className = `anchor ${pos}`;
    anchor.dataset.pos = pos;
    el.appendChild(anchor);

    anchor.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      state.pendingConnectionFrom = id;
      state.isDraggingConnection = true;
      state.connectionDragPos = { x: e.clientX, y: e.clientY };
      document.addEventListener('pointermove', handleConnectionMove);
      document.addEventListener('pointerup', handleConnectionUp, { once: true });
    });
  });

  canvas.appendChild(el);

  const elementData = { id, type, x, y, label: labelEl.textContent, el };
  state.elements.set(id, elementData);

  // Inline Editing
  el.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    el.classList.add('editing');
    labelEl.contentEditable = true;

    // If the text is just the default type name, clear it to show placeholder
    if (labelEl.textContent === (typeLabels[type] || 'Element')) {
      labelEl.textContent = '';
    }

    labelEl.focus();

    const finishEdit = () => {
      el.classList.remove('editing');
      labelEl.contentEditable = false;

      // If empty, revert to default or keep empty (placeholder will show)
      const finalValue = labelEl.textContent.trim();
      if (elementData.label !== finalValue) {
        elementData.label = finalValue || (typeLabels[type] || 'Element');
        labelEl.textContent = elementData.label;
        labelInput.value = elementData.label;
        saveState();
      }
      labelEl.removeEventListener('blur', finishEdit);
      labelEl.removeEventListener('keydown', keyFinish);
    };

    const keyFinish = (ke) => {
      if (ke.key === 'Enter') {
        ke.preventDefault();
        finishEdit();
      }
      if (ke.key === 'Escape') {
        labelEl.textContent = elementData.label;
        finishEdit();
      }
    };

    labelEl.addEventListener('blur', finishEdit);
    labelEl.addEventListener('keydown', keyFinish);
  });

  el.addEventListener('pointerdown', (event) => {
    if (event.target.classList.contains('anchor') || el.classList.contains('editing')) return;

    if (state.connectMode) {
      handleConnectClick(id);
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const startX = event.clientX - rect.left;
    const startY = event.clientY - rect.top;
    const offsetX = startX - elementData.x;
    const offsetY = startY - elementData.y;

    state.dragging = { id, offsetX, offsetY };
    el.classList.add('dragging');
    el.setPointerCapture(event.pointerId);
    setSelected(id);
  });

  el.addEventListener('pointermove', (event) => {
    if (el.classList.contains('editing')) return;
    // Proximity logic for anchors
    if (!state.dragging) {
      const rect = el.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      const anchorNodes = el.querySelectorAll('.anchor');
      let closestAnchor = null;
      let minDistance = Infinity;

      anchorNodes.forEach(anchor => {
        const x = anchor.offsetLeft + anchor.offsetWidth / 2;
        const y = anchor.offsetTop + anchor.offsetHeight / 2;
        const dist = Math.hypot(mouseX - x, mouseY - y);

        anchor.classList.remove('visible');
        if (dist < minDistance) {
          minDistance = dist;
          closestAnchor = anchor;
        }
      });

      if (closestAnchor && minDistance < 60) {
        closestAnchor.classList.add('visible');
      }
    }

    // Dragging logic for element
    if (!state.dragging || state.dragging.id !== id) return;
    const rect = canvas.getBoundingClientRect();
    const nextX = event.clientX - rect.left - state.dragging.offsetX;
    const nextY = event.clientY - rect.top - state.dragging.offsetY;
    moveElement(id, nextX, nextY);
  });

  el.addEventListener('pointerleave', () => {
    el.querySelectorAll('.anchor').forEach(a => a.classList.remove('visible'));
  });

  el.addEventListener('pointerup', () => {
    if (state.dragging && state.dragging.id === id) {
      state.dragging = null;
      el.classList.remove('dragging');
      saveState(); // Save after move
    }
  });

  // Custom Context Menu
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();

    setSelected(id);

    contextMenu.style.display = 'block';
    contextMenu.style.left = `${e.clientX}px`;
    contextMenu.style.top = `${e.clientY}px`;

    // Menu Actions
    menuEdit.onclick = () => {
      hideContextMenu();
      el.dispatchEvent(new MouseEvent('dblclick'));
    };

    menuDuplicate.onclick = () => {
      hideContextMenu();
      const newX = elementData.x + 40;
      const newY = elementData.y + 40;
      createElement(elementData.type, newX, newY, elementData.label);
    };

    menuDelete.onclick = () => {
      hideContextMenu();
      deleteSelected();
    };
  });

  updateCanvasHint();
  if (!isRestoring) saveState();
  return id;
}

function hideContextMenu() {
  contextMenu.style.display = 'none';
}

// Global Hide Context Menu
window.addEventListener('click', hideContextMenu);
window.addEventListener('contextmenu', (e) => {
  if (!e.target.closest('.er-node')) {
    hideContextMenu();
  }
});

// Global Shortucts
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault();
    undo();
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
    e.preventDefault();
    redo();
  }
});

// Seed initial state
window.addEventListener('DOMContentLoaded', () => {
  saveState();
});

function handleConnectionMove(e) {
  state.connectionDragPos = { x: e.clientX, y: e.clientY };
  renderConnections();
}

function handleConnectionUp(e) {
  const target = document.elementFromPoint(e.clientX, e.clientY);
  const node = target?.closest('.er-node');

  if (node) {
    const targetId = node.dataset.id;
    if (targetId && targetId !== state.pendingConnectionFrom) {
      const exists = state.connections.some(c =>
        (c.from === state.pendingConnectionFrom && c.to === targetId) ||
        (c.from === targetId && c.to === state.pendingConnectionFrom)
      );
      if (!exists) {
        state.connections.push({
          id: `connection-${connectionCounter++}`,
          from: state.pendingConnectionFrom,
          to: targetId
        });
        saveState();
      }
    }
  }

  state.pendingConnectionFrom = null;
  state.isDraggingConnection = false;
  document.removeEventListener('pointermove', handleConnectionMove);
  renderConnections();
}

function updateCanvasHint() {
  if (state.elements.size > 0) {
    canvasHint.style.opacity = '0';
  } else {
    canvasHint.style.opacity = '1';
  }
}

function moveElement(id, x, y) {
  const item = state.elements.get(id);
  if (!item) return;

  const maxX = canvas.clientWidth - item.el.offsetWidth;
  const maxY = canvas.clientHeight - item.el.offsetHeight;

  const clampedX = Math.max(8, Math.min(x, maxX - 8));
  const clampedY = Math.max(8, Math.min(y, maxY - 8));

  item.x = clampedX;
  item.y = clampedY;
  item.el.style.left = `${clampedX}px`;
  item.el.style.top = `${clampedY}px`;

  renderConnections();
}

function renderConnections() {
  connectionsSvg.innerHTML = '';
  const canvasRect = canvas.getBoundingClientRect();

  // Draw existing connections
  state.connections.forEach((connection) => {
    const from = state.elements.get(connection.from);
    const to = state.elements.get(connection.to);
    if (!from || !to) return;

    const fromCenter = getElementCenter(from.el);
    const toCenter = getElementCenter(to.el);

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.className.baseVal = 'connection-line';
    line.setAttribute('x1', fromCenter.x);
    line.setAttribute('y1', fromCenter.y);
    line.setAttribute('x2', toCenter.x);
    line.setAttribute('y2', toCenter.y);
    connectionsSvg.appendChild(line);
  });

  // Draw active preview line
  if (state.isDraggingConnection && state.pendingConnectionFrom) {
    const from = state.elements.get(state.pendingConnectionFrom);
    if (from) {
      const fromCenter = getElementCenter(from.el);
      const toX = state.connectionDragPos.x - canvasRect.left;
      const toY = state.connectionDragPos.y - canvasRect.top;

      const previewLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      previewLine.className.baseVal = 'connection-line preview';
      previewLine.setAttribute('x1', fromCenter.x);
      previewLine.setAttribute('y1', fromCenter.y);
      previewLine.setAttribute('x2', toX);
      previewLine.setAttribute('y2', toY);
      connectionsSvg.appendChild(previewLine);
    }
  }
}

function getElementCenter(el) {
  const rect = el.getBoundingClientRect();
  const canvasRect = canvas.getBoundingClientRect();
  return {
    x: rect.left - canvasRect.left + rect.width / 2,
    y: rect.top - canvasRect.top + rect.height / 2,
  };
}

function handleConnectClick(id) {
  if (!state.pendingConnectionFrom) {
    state.pendingConnectionFrom = id;
    setSelected(id);
    return;
  }

  if (state.pendingConnectionFrom === id) {
    state.pendingConnectionFrom = null;
    return;
  }

  const exists = state.connections.some((connection) =>
    (connection.from === state.pendingConnectionFrom && connection.to === id) ||
    (connection.from === id && connection.to === state.pendingConnectionFrom)
  );

  if (!exists) {
    state.connections.push({
      id: `connection-${connectionCounter++}`,
      from: state.pendingConnectionFrom,
      to: id,
    });
  }

  state.pendingConnectionFrom = null;
  renderConnections();
}

function deleteSelected() {
  if (!state.selectedId) return;
  const item = state.elements.get(state.selectedId);
  if (!item) return;

  item.el.remove();
  state.elements.delete(state.selectedId);
  state.connections = state.connections.filter(
    (connection) => connection.from !== state.selectedId && connection.to !== state.selectedId
  );
  setSelected(null);
  renderConnections();
  updateCanvasHint();
  saveState();
}

function clearCanvas() {
  state.elements.forEach((item) => item.el.remove());
  state.elements.clear();
  state.connections = [];
  state.pendingConnectionFrom = null;
  setSelected(null);
  renderConnections();
  updateCanvasHint();
}

function loadTemplate(key) {
  if (!templates[key]) return;
  const confirmLoad = window.confirm('Loading this template will clear the current canvas. Continue?');
  if (!confirmLoad) return;

  clearCanvas();
  const idMap = new Map();

  templates[key].elements.forEach((item) => {
    const id = createElement(item.type, item.x, item.y, item.label);
    idMap.set(item.key, id);
  });

  templates[key].connections.forEach(([fromKey, toKey]) => {
    const fromId = idMap.get(fromKey);
    const toId = idMap.get(toKey);
    if (fromId && toId) {
      state.connections.push({
        id: `connection-${connectionCounter++}`,
        from: fromId,
        to: toId,
      });
    }
  });

  renderConnections();
}

function toggleConnectMode() {
  state.connectMode = !state.connectMode;
  connectToggle.textContent = state.connectMode ? 'Connect: On' : 'Connect: Off';
  connectToggle.classList.toggle('active', state.connectMode);
  state.pendingConnectionFrom = null;
}

paletteItems.forEach((item) => {
  item.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    const type = item.dataset.type;
    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.textContent = typeLabels[type] || 'Element';
    document.body.appendChild(ghost);

    const moveGhost = (moveEvent) => {
      ghost.style.left = `${moveEvent.clientX + 12}px`;
      ghost.style.top = `${moveEvent.clientY + 12}px`;
    };

    const dropGhost = (upEvent) => {
      const canvasRect = canvas.getBoundingClientRect();
      if (
        upEvent.clientX >= canvasRect.left &&
        upEvent.clientX <= canvasRect.right &&
        upEvent.clientY >= canvasRect.top &&
        upEvent.clientY <= canvasRect.bottom
      ) {
        const x = upEvent.clientX - canvasRect.left - 60;
        const y = upEvent.clientY - canvasRect.top - 30;
        const label = '';
        createElement(type, x, y, label);
        renderConnections();
      }
      document.removeEventListener('pointermove', moveGhost);
      document.removeEventListener('pointerup', dropGhost);
      ghost.remove();
    };

    document.addEventListener('pointermove', moveGhost);
    document.addEventListener('pointerup', dropGhost, { once: true });
  });
});

canvas.addEventListener('pointerdown', (event) => {
  if (event.target === canvas || event.target === connectionsSvg) {
    setSelected(null);
  }
});

labelInput.addEventListener('input', (event) => {
  if (!state.selectedId) return;
  const item = state.elements.get(state.selectedId);
  if (!item) return;
  item.label = event.target.value || typeLabels[item.type];
  const labelEl = item.el.querySelector('.label');
  if (labelEl) labelEl.textContent = item.label;
});

connectToggle.addEventListener('click', toggleConnectMode);

deleteBtn.addEventListener('click', deleteSelected);

clearBtn.addEventListener('click', () => {
  if (state.elements.size === 0) return;
  const confirmClear = window.confirm('Clear the entire canvas?');
  if (confirmClear) clearCanvas();
});

templateButtons.forEach((button) => {
  button.addEventListener('click', () => loadTemplate(button.dataset.template));
});

window.addEventListener('resize', renderConnections);

labelInput.disabled = true;
