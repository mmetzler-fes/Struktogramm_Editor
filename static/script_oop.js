// =====================================================================
// Object-Oriented Struktogramm Editor
// =====================================================================

// ========================
// Base Classes
// ========================

/**
 * GraphState - verwaltet den internen Zustand des Graphen
 */
class GraphState {
	constructor() {
		this.nodes = [];
		this.edges = [];
		this.initialize();
	}

	initialize() {
		this.nodes.push({ id: 'start_node_id', type: 'start', text: 'Start' });
		this.nodes.push({ id: 'end_node_id', type: 'end', text: 'End' });
		this.edges.push({ from: 'start_node_id', to: 'end_node_id' });
	}

	getNode(id) {
		return this.nodes.find(n => n.id === id);
	}

	addNode(node) {
		this.nodes.push(node);
	}

	removeNode(id) {
		const idx = this.nodes.findIndex(n => n.id === id);
		if (idx !== -1) {
			this.nodes.splice(idx, 1);
		}
	}

	addEdge(edge) {
		this.edges.push(edge);
	}

	removeEdge(from, to) {
		const idx = this.edges.findIndex(e => e.from === from && e.to === to);
		if (idx !== -1) {
			this.edges.splice(idx, 1);
			return true;
		}
		return false;
	}

	findEdge(from, to) {
		return this.edges.findIndex(e => e.from === from && e.to === to);
	}

	getEdge(from, to) {
		return this.edges.find(e => e.from === from && e.to === to);
	}

	getSuccessors(nodeId) {
		return this.edges.filter(e => e.from === nodeId).map(e => e.to);
	}

	getEdgeLabel(fromId, toId) {
		const edge = this.getEdge(fromId, toId);
		return edge ? (edge.label || '') : '';
	}
}

/**
 * BlockFactory - erstellt Blöcke verschiedener Typen
 */
class BlockFactory {
	static generateId() {
		return Date.now().toString(36) + Math.random().toString(36).substr(2);
	}

	static createBlock(type, graphState) {
		const id = this.generateId();
		const block = {
			id: id,
			type: type,
			text: this.getDefaultText(type),
		};

		if (type === 'if_else') {
			return this.createIfElseBlock(block, graphState);
		} else if (['for_loop', 'while_loop', 'repeat_loop'].includes(type)) {
			return this.createLoopBlock(block, type, graphState);
		} else if (type === 'case') {
			return this.createCaseBlock(block, graphState);
		}

		return { mainBlock: block, additionalNodes: [], additionalEdges: [] };
	}

	static getDefaultText(type) {
		const defaults = {
			'command': 'Do something',
			'if_else': 'Bedingung',
			'for_loop': 'i = 0 to 10',
			'while_loop': 'while condition',
			'repeat_loop': 'until condition',
			'subprogram': 'Subprogram Name',
			'case': 'switch'
		};
		return defaults[type] || type;
	}

	static createIfElseBlock(block, graphState) {
		const mergeId = block.id + '_merge';
		const trueDummyId = block.id + '_true_dummy';
		const falseDummyId = block.id + '_false_dummy';

		const additionalNodes = [
			{ id: mergeId, type: 'join', text: ' ' },
			{ id: trueDummyId, type: 'join', text: ' ' },
			{ id: falseDummyId, type: 'join', text: ' ' }
		];

		const additionalEdges = [
			{ from: block.id, to: trueDummyId, label: 'Ja' },
			{ from: trueDummyId, to: mergeId },
			{ from: block.id, to: falseDummyId, label: 'Nein' },
			{ from: falseDummyId, to: mergeId }
		];

		block.branches = [];

		return { mainBlock: block, additionalNodes, additionalEdges, exitId: mergeId };
	}

	static createLoopBlock(block, type, graphState) {
		const bodyDummyId = block.id + '_body_dummy';

		const additionalNodes = [
			{ id: bodyDummyId, type: 'join', text: ' ' }
		];

		const additionalEdges = [
			{ from: block.id, to: bodyDummyId },
			{ from: bodyDummyId, to: block.id }
		];

		return { mainBlock: block, additionalNodes, additionalEdges };
	}

	static createCaseBlock(block, graphState) {
		const mergeId = block.id + '_merge';
		const dummy1Id = block.id + '_case_1';
		const dummy2Id = block.id + '_case_2';
		const dummy3Id = block.id + '_case_default';

		const additionalNodes = [
			{ id: mergeId, type: 'join', text: ' ' },
			{ id: dummy1Id, type: 'join', text: ' ' },
			{ id: dummy2Id, type: 'join', text: ' ' },
			{ id: dummy3Id, type: 'join', text: ' ' }
		];

		const additionalEdges = [
			{ from: block.id, to: dummy1Id, label: '1' },
			{ from: dummy1Id, to: mergeId },
			{ from: block.id, to: dummy2Id, label: '2' },
			{ from: dummy2Id, to: mergeId },
			{ from: block.id, to: dummy3Id, label: 'Default' },
			{ from: dummy3Id, to: mergeId }
		];

		block.branches = [];

		return { mainBlock: block, additionalNodes, additionalEdges, exitId: mergeId };
	}
}

/**
 * StructureBuilder - konvertiert Graph zu Baumstruktur für Rendering
 */
class StructureBuilder {
	constructor(graphState) {
		this.graphState = graphState;
	}

	buildStructure(startNodeId, stopNodeId, visited = new Set()) {
		const blocks = [];
		let currentNodeId = startNodeId;

		while (currentNodeId && currentNodeId !== stopNodeId) {
			if (visited.has(currentNodeId)) {
				break;
			}

			visited.add(currentNodeId);
			const node = this.graphState.getNode(currentNodeId);
			if (!node) break;

			const successors = this.graphState.getSuccessors(currentNodeId);

			// Case Block
			if (node.type === 'case') {
				currentNodeId = this.buildCaseBlock(node, successors, blocks, visited);
			}
			// Decision or Loop Head (2 successors)
			else if (successors.length === 2) {
				if (node.type.includes('loop')) {
					currentNodeId = this.buildLoopBlock(node, successors, blocks, visited);
				} else {
					currentNodeId = this.buildIfElseBlock(node, successors, blocks, visited);
				}
			}
			// Process or Dummy (1 successor)
			else if (successors.length === 1) {
				if (node.type === 'join' || (!node.text.trim() && node.text !== '...')) {
					currentNodeId = successors[0];
					continue;
				}

				blocks.push({
					type: node.type,
					id: node.id,
					text: node.text
				});
				currentNodeId = successors[0];
			}
			// Terminal or End
			else {
				if (node.type !== 'end' && node.type !== 'start') {
					blocks.push({
						type: node.type,
						id: node.id,
						text: node.text
					});
				}
				currentNodeId = null;
			}
		}

		return blocks;
	}

	buildCaseBlock(node, successors, blocks, visited) {
		let mergeNodeId;
		if (successors.length >= 2) {
			mergeNodeId = this.findMergeNode(successors[0], successors[1], node.id);
		} else if (successors.length === 1) {
			const dummySuccs = this.graphState.getSuccessors(successors[0]);
			mergeNodeId = dummySuccs.length > 0 ? dummySuccs[0] : null;
		}

		if (mergeNodeId) {
			const branches = successors.map(succId => {
				const label = this.graphState.getEdgeLabel(node.id, succId);
				const branchBlocks = this.buildStructure(succId, mergeNodeId, new Set(visited));
				return {
					label: label,
					children: branchBlocks,
					startNodeId: succId
				};
			});

			blocks.push({
				type: 'case',
				id: node.id,
				text: node.text,
				branches: branches,
				exitId: mergeNodeId
			});

			return mergeNodeId;
		} else {
			console.warn('Merge node not found for case', node.id);
			return successors.length > 0 ? successors[0] : null;
		}
	}

	buildLoopBlock(node, successors, blocks, visited) {
		let bodyStartId, exitId;
		const label0 = this.graphState.getEdgeLabel(node.id, successors[0]).toLowerCase();

		if (label0.includes('exit')) {
			exitId = successors[0];
			bodyStartId = successors[1];
		} else {
			bodyStartId = successors[0];
			exitId = successors[1];
		}

		// Wichtig: children immer als Array initialisieren, auch bei Fehler
		let bodyBlocks = [];
		try {
			bodyBlocks = this.buildStructure(bodyStartId, node.id, new Set(visited));
		} catch (e) {
			console.error('Error building loop body:', e);
		}

		blocks.push({
			type: node.type,
			id: node.id,
			text: node.text,
			children: bodyBlocks // Immer ein Array, nie undefined
		});

		return exitId;
	}

	buildIfElseBlock(node, successors, blocks, visited) {
		if (node.type !== 'if_else') {
			console.warn(`Node ${node.id} (${node.type}) has 2 successors but is not a decision block! Treating as process.`);
			return successors[0];
		}

		const mergeNodeId = this.findMergeNode(successors[0], successors[1], node.id);
		let yesNodeId, noNodeId;
		const label0 = this.graphState.getEdgeLabel(node.id, successors[0]).toLowerCase();

		if (label0.includes('ja') || label0.includes('yes') || label0.includes('true')) {
			yesNodeId = successors[0];
			noNodeId = successors[1];
		} else {
			yesNodeId = successors[1];
			noNodeId = successors[0];
		}

		const yesBlocks = this.buildStructure(yesNodeId, mergeNodeId, new Set(visited));
		const noBlocks = this.buildStructure(noNodeId, mergeNodeId, new Set(visited));

		blocks.push({
			type: 'if_else',
			id: node.id,
			text: node.text,
			branches: [
				{ label: 'Ja', children: yesBlocks },
				{ label: 'Nein', children: noBlocks }
			],
			exitId: mergeNodeId
		});

		return mergeNodeId;
	}

	findMergeNode(node1Id, node2Id, forbiddenId) {
		const visited1 = new Set();
		const queue1 = [node1Id];
		const visited2 = new Set();
		const queue2 = [node2Id];

		let iter = 0;
		while ((queue1.length > 0 || queue2.length > 0) && iter < 1000) {
			iter++;

			if (queue1.length > 0) {
				const n = queue1.shift();
				if (visited2.has(n)) return n;
				if (!visited1.has(n)) {
					visited1.add(n);
					const succ = this.graphState.getSuccessors(n);
					succ.forEach(s => {
						if (s !== forbiddenId) queue1.push(s);
					});
				}
			}

			if (queue2.length > 0) {
				const n = queue2.shift();
				if (visited1.has(n)) return n;
				if (!visited2.has(n)) {
					visited2.add(n);
					const succ = this.graphState.getSuccessors(n);
					succ.forEach(s => {
						if (s !== forbiddenId) queue2.push(s);
					});
				}
			}
		}

		console.warn(`Merge node not found for ${node1Id} and ${node2Id}`);
		return null;
	}
}

/**
 * Renderer - rendert das Diagramm
 */
class Renderer {
	constructor(graphState, canvas) {
		this.graphState = graphState;
		this.canvas = canvas;
		this.structureBuilder = new StructureBuilder(graphState);
	}

	render() {
		try {
			this.canvas.innerHTML = '';

			const startSuccessors = this.graphState.getSuccessors('start_node_id');
			const firstNodeId = startSuccessors.length > 0 ? startSuccessors[0] : null;

			const tree = firstNodeId ? this.structureBuilder.buildStructure(firstNodeId, 'end_node_id', new Set()) : [];
			console.log('Render Tree:', JSON.stringify(tree, null, 2));

			const container = document.createElement('div');
			container.className = 'nsd-container';

			this.renderTree(tree, container, 'start_node_id', 'end_node_id');
			this.canvas.appendChild(container);

			// Update Mermaid and If/Else blocks
			setTimeout(() => {
				if (typeof updateMermaid === 'function') updateMermaid();
				if (typeof updateAllIfElseBlocks === 'function') updateAllIfElseBlocks();
			}, 100);
		} catch (e) {
			console.error(e);
			this.canvas.innerHTML = `<div style="color:red; padding:20px;">Error rendering diagram: ${e.message}<br><pre>${e.stack}</pre></div>`;
		}
	}

	renderTree(blocks, parentContainer, predecessorId, successorId) {
		let currentPredecessor = predecessorId;

		blocks.forEach(block => {
			const edgeIndex = this.graphState.findEdge(currentPredecessor, block.id);

			if (edgeIndex !== -1) {
				const dropZone = this.createInsertionDropZone(edgeIndex);
				parentContainer.appendChild(dropZone);
			} else {
				console.warn(`Edge not found: ${currentPredecessor} -> ${block.id}`);
			}

			parentContainer.appendChild(this.renderBlockGraph(block));

			if (block.exitId) {
				currentPredecessor = block.exitId;
			} else {
				currentPredecessor = block.id;
			}
		});

		const edgeIndex = this.graphState.findEdge(currentPredecessor, successorId);
		if (edgeIndex !== -1) {
			const dropZone = this.createInsertionDropZone(edgeIndex);

			if (blocks.length === 0) {
				if (predecessorId === 'start_node_id' && successorId === 'end_node_id') {
					dropZone.classList.add('initial-zone');
					dropZone.dataset.placeholder = 'Drag blocks here to start';
				} else {
					dropZone.classList.add('empty-container-zone');
					dropZone.dataset.placeholder = 'Drop here';
				}
			}

			parentContainer.appendChild(dropZone);
		} else {
			console.warn(`Edge not found: ${currentPredecessor} -> ${successorId}`);
		}
	}

	createInsertionDropZone(edgeIndex) {
		const zone = document.createElement('div');
		zone.className = 'insertion-drop-zone';
		const edge = this.graphState.edges[edgeIndex];
		if (edge) {
			zone.dataset.edgeFrom = edge.from;
			zone.dataset.edgeTo = edge.to;
		}
		// setupDropZone will be called by BlockManager
		return zone;
	}

	renderBlockGraph(block) {
		const el = document.createElement('div');
		let classes = `nsd-block block-${block.type}`;

		if (['for_loop', 'while_loop', 'repeat_loop'].includes(block.type)) {
			classes += ' block-loop';
		} else if (block.type === 'if_else') {
			classes += ' block-if';
		}

		el.className = classes;
		el.dataset.id = block.id;

		if (block.type === 'command' || block.type === 'subprogram' || block.type === 'exit' || block.type === 'process') {
			el.textContent = block.text;
			this.makeEditable(el, block.id);
		} else if (block.type === 'if_else') {
			this.renderIfElseBlock(block, el);
		} else if (['for_loop', 'while_loop', 'repeat_loop'].includes(block.type)) {
			this.renderLoopBlock(block, el);
		} else if (block.type === 'case') {
			this.renderCaseBlock(block, el);
		}

		return el;
	}

	renderIfElseBlock(block, el) {
		const header = document.createElement('div');
		header.className = 'block-if-header';

		const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		svg.setAttribute("class", "if-svg");
		svg.setAttribute("viewBox", "0 0 100 100");
		svg.setAttribute("preserveAspectRatio", "none");

		const lineL = document.createElementNS("http://www.w3.org/2000/svg", "line");
		lineL.setAttribute("x1", "0");
		lineL.setAttribute("y1", "0");
		lineL.setAttribute("x2", "50");
		lineL.setAttribute("y2", "100");
		lineL.setAttribute("stroke", "black");
		lineL.setAttribute("stroke-width", "1");
		svg.appendChild(lineL);

		const lineR = document.createElementNS("http://www.w3.org/2000/svg", "line");
		lineR.setAttribute("x1", "100");
		lineR.setAttribute("y1", "0");
		lineR.setAttribute("x2", "50");
		lineR.setAttribute("y2", "100");
		lineR.setAttribute("stroke", "black");
		lineR.setAttribute("stroke-width", "1");
		svg.appendChild(lineR);

		header.appendChild(svg);

		const textContainer = document.createElement('div');
		textContainer.className = 'if-condition-text';
		textContainer.textContent = block.text;
		this.makeEditable(textContainer, block.id);
		header.appendChild(textContainer);

		el.appendChild(header);

		const body = document.createElement('div');
		body.className = 'block-if-body';

		if (block.branches && block.branches.length === 2) {
			block.branches.forEach((branch, index) => {
				const branchEl = document.createElement('div');
				branchEl.className = 'block-if-branch';

				const labelDiv = document.createElement('div');
				labelDiv.className = 'if-branch-label';
				labelDiv.textContent = branch.label;
				branchEl.appendChild(labelDiv);

				const successors = this.graphState.getSuccessors(block.id);
				const trueNodeId = successors.find(s => {
					const l = this.graphState.getEdgeLabel(block.id, s).toLowerCase();
					return l.includes('ja') || l.includes('yes') || l.includes('true');
				});
				const falseNodeId = successors.find(s => s !== trueNodeId);

				const startNodeId = index === 0 ? trueNodeId : falseNodeId;

				if (startNodeId && branch.children) {
					this.renderTree(branch.children, branchEl, startNodeId, block.exitId);
				}

				body.appendChild(branchEl);
			});
		}

		el.appendChild(body);

		setTimeout(() => {
			if (typeof observeIfResize === 'function') {
				observeIfResize(el, header, body);
			}
		}, 0);
	}

	renderLoopBlock(block, el) {
		const isFootControlled = block.type === 'repeat_loop';

		const header = document.createElement('div');
		header.className = 'block-loop-header';
		header.textContent = block.text;
		this.makeEditable(header, block.id);

		const body = document.createElement('div');
		body.className = 'block-loop-body';

		const spacer = document.createElement('div');
		spacer.className = 'loop-spacer';
		body.appendChild(spacer);

		const content = document.createElement('div');
		content.className = 'loop-content';

		const successors = this.graphState.getSuccessors(block.id);
		let bodyStartId = successors.find(s => !this.graphState.getEdgeLabel(block.id, s).toLowerCase().includes('exit'));

		if (!bodyStartId && successors.length > 0) bodyStartId = successors[0];

		// Wichtig: children wird jetzt immer gesetzt, aber zur Sicherheit prüfen
		const children = block.children || [];
		this.renderTree(children, content, bodyStartId, block.id);

		body.appendChild(content);

		if (isFootControlled) {
			el.appendChild(body);
			el.appendChild(header);
		} else {
			el.appendChild(header);
			el.appendChild(body);
		}
	}

	renderCaseBlock(block, el) {
		const header = document.createElement('div');
		header.className = 'block-case-header';
		header.style.position = 'relative';

		const textContainer = document.createElement('div');
		textContainer.style.position = 'absolute';
		textContainer.style.top = '5px';
		textContainer.style.width = '100%';
		textContainer.style.textAlign = 'center';
		textContainer.style.zIndex = '5';
		textContainer.textContent = block.text;
		this.makeEditable(textContainer, block.id);
		header.appendChild(textContainer);

		const nBranches = block.branches ? block.branches.length : 0;
		const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		svg.setAttribute("class", "case-svg");
		svg.setAttribute("viewBox", "0 0 100 100");
		svg.setAttribute("preserveAspectRatio", "none");
		header.appendChild(svg);

		const splitY = 60;
		const segW = 100 / nBranches;

		if (block.branches) {
			block.branches.forEach((branch, index) => {
				const labelDiv = document.createElement('div');
				labelDiv.className = 'case-header-label';
				labelDiv.dataset.index = index;
				labelDiv.style.position = 'absolute';
				labelDiv.style.top = splitY + '%';
				labelDiv.style.left = (index * segW) + '%';
				labelDiv.style.width = segW + '%';
				labelDiv.style.height = (100 - splitY) + '%';
				labelDiv.style.textAlign = 'center';
				labelDiv.style.display = 'flex';
				labelDiv.style.alignItems = 'center';
				labelDiv.style.justifyContent = 'center';
				labelDiv.style.zIndex = '5';
				labelDiv.textContent = branch.label;

				labelDiv.contentEditable = true;
				labelDiv.addEventListener('blur', (e) => {
					const edge = this.graphState.edges.find(ed => ed.from === block.id && ed.to === branch.startNodeId);
					if (edge) {
						edge.label = e.target.textContent;
						if (typeof updateMermaid === 'function') updateMermaid();
					}
				});
				labelDiv.addEventListener('click', (e) => e.stopPropagation());
				header.appendChild(labelDiv);
			});
		}

		// Draw SVG lines
		const lineL = document.createElementNS("http://www.w3.org/2000/svg", "line");
		lineL.setAttribute("x1", "0");
		lineL.setAttribute("y1", "0");
		lineL.setAttribute("x2", segW + "%");
		lineL.setAttribute("y2", splitY + "%");
		lineL.setAttribute("stroke", "black");
		lineL.setAttribute("stroke-width", "1");
		svg.appendChild(lineL);

		const lineR = document.createElementNS("http://www.w3.org/2000/svg", "line");
		lineR.setAttribute("x1", "100");
		lineR.setAttribute("y1", "0");
		lineR.setAttribute("x2", (100 - segW) + "%");
		lineR.setAttribute("y2", splitY + "%");
		lineR.setAttribute("stroke", "black");
		lineR.setAttribute("stroke-width", "1");
		svg.appendChild(lineR);

		if (nBranches > 2) {
			const lineH = document.createElementNS("http://www.w3.org/2000/svg", "line");
			lineH.setAttribute("x1", segW + "%");
			lineH.setAttribute("y1", splitY + "%");
			lineH.setAttribute("x2", (100 - segW) + "%");
			lineH.setAttribute("y2", splitY + "%");
			lineH.setAttribute("stroke", "black");
			lineH.setAttribute("stroke-width", "1");
			svg.appendChild(lineH);

			for (let i = 1; i < nBranches - 1; i++) {
				const x = (i + 1) * segW;
				const lineV = document.createElementNS("http://www.w3.org/2000/svg", "line");
				lineV.setAttribute("x1", x + "%");
				lineV.setAttribute("y1", splitY + "%");
				lineV.setAttribute("x2", x + "%");
				lineV.setAttribute("y2", "100%");
				lineV.setAttribute("stroke", "black");
				lineV.setAttribute("stroke-width", "1");
				lineV.setAttribute("data-sep-index", i);
				svg.appendChild(lineV);
			}
		}

		el.appendChild(header);

		const body = document.createElement('div');
		body.className = 'block-case-body';

		if (block.branches) {
			block.branches.forEach((branch, index) => {
				const branchEl = document.createElement('div');
				branchEl.className = 'block-case-branch';
				branchEl.dataset.caseId = branch.startNodeId;

				if (branch.children) {
					this.renderTree(branch.children, branchEl, branch.startNodeId, block.exitId);
				}

				body.appendChild(branchEl);
			});
		}

		el.appendChild(body);

		setTimeout(() => {
			if (typeof observeCaseResize === 'function') {
				observeCaseResize(el, header, body);
			}
		}, 50);
	}

	makeEditable(element, blockId) {
		element.contentEditable = true;
		element.addEventListener('blur', (e) => {
			const node = this.graphState.getNode(blockId);
			if (node) {
				node.text = e.target.textContent;
				if (typeof updateMermaid === 'function') updateMermaid();
			}
		});
		element.addEventListener('click', (e) => e.stopPropagation());
	}
}

/**
 * BlockManager - verwaltet das Hinzufügen, Löschen und Verschieben von Blöcken
 */
class BlockManager {
	constructor(graphState, renderer) {
		this.graphState = graphState;
		this.renderer = renderer;
		this.moveSourceId = null;
		this.setupMoveIndicator();
	}

	setupMoveIndicator() {
		this.moveIndicator = document.createElement('div');
		this.moveIndicator.id = 'move-indicator';
		document.body.appendChild(this.moveIndicator);
	}

	addBlock(type, edgeIndex) {
		const blockData = BlockFactory.createBlock(type, this.graphState);
		const { mainBlock, additionalNodes, additionalEdges, exitId } = blockData;

		this.graphState.addNode(mainBlock);
		additionalNodes.forEach(node => this.graphState.addNode(node));

		const edge = this.graphState.edges[edgeIndex];
		const fromId = edge.from;
		const toId = edge.to;
		const label = edge.label;

		this.graphState.edges.splice(edgeIndex, 1);

		if (type === 'if_else' || type === 'case') {
			this.graphState.addEdge({ from: fromId, to: mainBlock.id, label: label });
			additionalEdges.forEach(e => this.graphState.addEdge(e));
			this.graphState.addEdge({ from: exitId, to: toId });
		} else if (['for_loop', 'while_loop', 'repeat_loop'].includes(type)) {
			this.graphState.addEdge({ from: fromId, to: mainBlock.id, label: label });
			additionalEdges.forEach(e => this.graphState.addEdge(e));
			this.graphState.addEdge({ from: mainBlock.id, to: toId, label: 'Exit' });
		} else {
			this.graphState.addEdge({ from: fromId, to: mainBlock.id, label: label });
			this.graphState.addEdge({ from: mainBlock.id, to: toId });
		}

		this.renderer.render();
	}

	deleteBlock(id) {
		const nodeIndex = this.graphState.nodes.findIndex(n => n.id === id);
		if (nodeIndex === -1) return;

		const node = this.graphState.nodes[nodeIndex];
		const inEdges = this.graphState.edges.filter(e => e.to === id);
		const outEdges = this.graphState.edges.filter(e => e.from === id);

		const nodesToDelete = [id];
		if (['if_else', 'for_loop', 'while_loop', 'repeat_loop', 'case'].includes(node.type)) {
			let exitId = null;
			const successors = this.graphState.getSuccessors(id);

			if (node.type === 'if_else' || node.type === 'case') {
				if (successors.length >= 2) {
					exitId = this.findMergeNode(successors[0], successors[1], id);
				} else if (node.type === 'case' && successors.length === 1) {
					const dummySuccs = this.graphState.getSuccessors(successors[0]);
					exitId = dummySuccs.length > 0 ? dummySuccs[0] : null;
				}
			} else {
				exitId = successors.find(s => this.graphState.getEdgeLabel(id, s).toLowerCase().includes('exit'));
			}

			if (exitId) {
				const internalNodes = this.graphState.nodes.filter(n => n.id.startsWith(id + '_'));
				internalNodes.forEach(n => nodesToDelete.push(n.id));

				const exitSuccessors = this.graphState.getSuccessors(exitId);
				if (node.type === 'if_else' || node.type === 'case') {
					if (exitSuccessors.length > 0) {
						const finalSuccessor = exitSuccessors[0];
						nodesToDelete.push(exitId);
						outEdges.length = 0;
						outEdges.push({ from: id, to: finalSuccessor });
					}
				} else {
					outEdges.length = 0;
					outEdges.push({ from: id, to: exitId });
				}
			}
		}

		nodesToDelete.forEach(nid => {
			const idx = this.graphState.nodes.findIndex(n => n.id === nid);
			if (idx !== -1) this.graphState.nodes.splice(idx, 1);

			for (let i = this.graphState.edges.length - 1; i >= 0; i--) {
				const e = this.graphState.edges[i];
				if (e.from === nid || e.to === nid) {
					this.graphState.edges.splice(i, 1);
				}
			}
		});

		if (inEdges.length > 0 && outEdges.length > 0) {
			const source = inEdges[0].from;
			const target = outEdges[0].to;

			const exists = this.graphState.edges.some(e => e.from === source && e.to === target);
			if (!exists) {
				this.graphState.addEdge({ from: source, to: target });
			}
		} else if (inEdges.length > 0 && inEdges[0].from === 'start_node_id') {
			const endNode = this.graphState.getNode('end_node_id');
			if (endNode) {
				const edgeToEnd = this.graphState.edges.some(e => e.to === 'end_node_id');
				if (!edgeToEnd) {
					this.graphState.addEdge({ from: 'start_node_id', to: 'end_node_id' });
				}
			}
		}

		this.renderer.render();
	}

	enterMoveMode(blockId) {
		this.moveSourceId = blockId;
		document.body.classList.add('move-mode');

		document.querySelectorAll('.nsd-block').forEach(el => {
			if (el.dataset.id === blockId) el.classList.add('move-source');
		});

		const node = this.graphState.getNode(blockId);
		const label = node ? `"${node.text}"` : 'Block';
		this.moveIndicator.textContent =
			`\u{1F4CD} Move-Modus: ${label} — Zielposition anklicken  |  Esc = Abbrechen`;
		this.moveIndicator.style.display = 'block';
	}

	exitMoveMode() {
		this.moveSourceId = null;
		document.body.classList.remove('move-mode');
		document.querySelectorAll('.move-source').forEach(el => el.classList.remove('move-source'));
		this.moveIndicator.style.display = 'none';
	}

	getInternalNodes(blockId) {
		const owned = [blockId];
		this.graphState.nodes.forEach(n => {
			if (n.id.startsWith(blockId + '_')) owned.push(n.id);
		});
		return owned;
	}

	getBlockBounds(blockId) {
		const node = this.graphState.getNode(blockId);
		if (!node) return null;

		const successors = this.graphState.getSuccessors(blockId);

		if (['if_else', 'case'].includes(node.type)) {
			let mergeId = null;
			if (successors.length >= 2) {
				mergeId = this.findMergeNode(successors[0], successors[1], blockId);
			} else if (successors.length === 1) {
				const ds = this.graphState.getSuccessors(successors[0]);
				mergeId = ds.length > 0 ? ds[0] : null;
			}
			if (!mergeId) return null;
			const ms = this.graphState.getSuccessors(mergeId);
			return { exitNodeId: mergeId, externalSuccessorId: ms[0] || null };
		}

		if (['for_loop', 'while_loop', 'repeat_loop'].includes(node.type)) {
			const exitSucc = successors.find(s =>
				this.graphState.getEdgeLabel(blockId, s).toLowerCase().includes('exit'));
			return { exitNodeId: blockId, externalSuccessorId: exitSucc || null };
		}

		return { exitNodeId: blockId, externalSuccessorId: successors[0] || null };
	}

	moveBlock(blockId, targetFrom, targetTo) {
		const node = this.graphState.getNode(blockId);
		if (!node) {
			this.exitMoveMode();
			return;
		}

		console.log('[MOVE] Starting move for block:', blockId);
		console.log('[MOVE] Target edge:', targetFrom, '->', targetTo);

		const internalNodes = this.getInternalNodes(blockId);
		console.log('[MOVE] Internal nodes:', internalNodes);
		if (internalNodes.includes(targetFrom) || internalNodes.includes(targetTo)) {
			alert('Ein Block kann nicht in sich selbst verschoben werden.');
			this.exitMoveMode();
			return;
		}

		const bounds = this.getBlockBounds(blockId);
		if (!bounds || !bounds.externalSuccessorId) {
			console.error('Move: Block-Grenzen konnten nicht bestimmt werden', blockId);
			this.exitMoveMode();
			return;
		}

		const { exitNodeId, externalSuccessorId } = bounds;
		console.log('[MOVE] Bounds - exitNodeId:', exitNodeId, 'externalSuccessorId:', externalSuccessorId);

		const predEdge = this.graphState.edges.find(e => e.to === blockId && !internalNodes.includes(e.from));
		if (!predEdge) {
			console.error('Move: Kein externer Vorgänger für Block', blockId);
			this.exitMoveMode();
			return;
		}
		const predecessorId = predEdge.from;
		const predecessorLabel = predEdge.label;
		console.log('[MOVE] Predecessor:', predecessorId, 'label:', predecessorLabel);

		if (predecessorId === targetFrom && externalSuccessorId === targetTo) {
			this.exitMoveMode();
			return;
		}

		console.log('[MOVE] STEP 1: Extracting from current position');
		console.log('[MOVE] Edges before extraction:', JSON.stringify(this.graphState.edges, null, 2));

		const removedExternal = [];
		this.graphState.edges = this.graphState.edges.filter(e => {
			if (e.to === blockId && !internalNodes.includes(e.from)) {
				removedExternal.push(e);
				return false;
			}
			return true;
		});
		console.log('[MOVE] Removed external edges to block:', removedExternal);

		const removedExit = [];
		this.graphState.edges = this.graphState.edges.filter(e => {
			if (e.from === exitNodeId && e.to === externalSuccessorId) {
				removedExit.push(e);
				return false;
			}
			return true;
		});
		console.log('[MOVE] Removed exit edges:', removedExit);

		const healEdge = { from: predecessorId, to: externalSuccessorId, label: predecessorLabel };
		this.graphState.addEdge(healEdge);
		console.log('[MOVE] Added heal edge:', healEdge);
		console.log('[MOVE] Edges after extraction:', JSON.stringify(this.graphState.edges, null, 2));

		console.log('[MOVE] STEP 2: Inserting at target edge');

		const targetIdx = this.graphState.edges.findIndex(
			e => e.from === targetFrom && e.to === targetTo);

		if (targetIdx === -1) {
			console.error('Move: Zielkante nach Extraktion nicht mehr vorhanden', targetFrom, '->', targetTo);
			this.exitMoveMode();
			this.renderer.render();
			return;
		}

		const targetLabel = this.graphState.edges[targetIdx].label;
		this.graphState.edges.splice(targetIdx, 1);
		console.log('[MOVE] Removed target edge:', targetFrom, '->', targetTo, 'label:', targetLabel);

		const insertEdge1 = { from: targetFrom, to: blockId, label: targetLabel };
		this.graphState.addEdge(insertEdge1);
		console.log('[MOVE] Added edge:', insertEdge1);

		const newExitLabel = ['for_loop', 'while_loop', 'repeat_loop'].includes(node.type)
			? 'Exit' : undefined;
		const insertEdge2 = { from: exitNodeId, to: targetTo, label: newExitLabel };
		this.graphState.addEdge(insertEdge2);
		console.log('[MOVE] Added exit edge:', insertEdge2);

		console.log('[MOVE] Final edges:', JSON.stringify(this.graphState.edges, null, 2));
		console.log('[MOVE] Move complete!');

		this.exitMoveMode();
		this.renderer.render();
	}

	findMergeNode(node1Id, node2Id, forbiddenId) {
		const visited1 = new Set();
		const queue1 = [node1Id];
		const visited2 = new Set();
		const queue2 = [node2Id];

		let iter = 0;
		while ((queue1.length > 0 || queue2.length > 0) && iter < 1000) {
			iter++;

			if (queue1.length > 0) {
				const n = queue1.shift();
				if (visited2.has(n)) return n;
				if (!visited1.has(n)) {
					visited1.add(n);
					const succ = this.graphState.getSuccessors(n);
					succ.forEach(s => {
						if (s !== forbiddenId) queue1.push(s);
					});
				}
			}

			if (queue2.length > 0) {
				const n = queue2.shift();
				if (visited1.has(n)) return n;
				if (!visited2.has(n)) {
					visited2.add(n);
					const succ = this.graphState.getSuccessors(n);
					succ.forEach(s => {
						if (s !== forbiddenId) queue2.push(s);
					});
				}
			}
		}

		console.warn(`Merge node not found for ${node1Id} and ${node2Id}`);
		return null;
	}

	addCaseOption(blockId) {
		const block = this.graphState.getNode(blockId);
		if (!block) return;

		const successors = this.graphState.getSuccessors(blockId);
		if (successors.length === 0) return;

		const structureBuilder = new StructureBuilder(this.graphState);
		const mergeId = structureBuilder.findMergeNode(successors[0], successors[1] || successors[0], blockId);

		if (!mergeId) {
			console.error("Could not find merge node to add case");
			return;
		}

		const newDummyId = blockId + '_case_' + Date.now();
		this.graphState.addNode({ id: newDummyId, type: 'join', text: ' ' });

		const outEdges = this.graphState.edges.filter(e => e.from === blockId);
		const defaultEdgeIndex = outEdges.findIndex(e => e.label.toLowerCase().trim() === 'default');

		const count = successors.length + 1;
		const newEdge = { from: blockId, to: newDummyId, label: (count - 1).toString() };
		const toMergeEdge = { from: newDummyId, to: mergeId };

		this.graphState.addEdge(toMergeEdge);

		if (defaultEdgeIndex !== -1) {
			const realDefaultEdge = outEdges[defaultEdgeIndex];
			const globalIndex = this.graphState.edges.indexOf(realDefaultEdge);

			if (globalIndex !== -1) {
				this.graphState.edges.splice(globalIndex, 0, newEdge);
			} else {
				this.graphState.addEdge(newEdge);
			}
		} else {
			this.graphState.addEdge(newEdge);
		}

		this.renderer.render();
	}

	deleteCaseOption(blockId, branchStartId) {
		const successors = this.graphState.getSuccessors(blockId);
		if (successors.length <= 3) {
			alert("Cannot delete. Minimum 2 cases + default required.");
			return;
		}

		const otherSucc = successors.find(s => s !== branchStartId);
		const structureBuilder = new StructureBuilder(this.graphState);
		const mergeId = structureBuilder.findMergeNode(branchStartId, otherSucc, blockId);

		if (!mergeId) return;

		const nodesToDelete = [];
		const queue = [branchStartId];
		const visited = new Set();

		while (queue.length > 0) {
			const n = queue.shift();
			if (n === mergeId) continue;
			if (visited.has(n)) continue;
			visited.add(n);
			nodesToDelete.push(n);

			const succs = this.graphState.getSuccessors(n);
			succs.forEach(s => queue.push(s));
		}

		nodesToDelete.forEach(nid => {
			const idx = this.graphState.nodes.findIndex(n => n.id === nid);
			if (idx !== -1) this.graphState.nodes.splice(idx, 1);
		});

		for (let i = this.graphState.edges.length - 1; i >= 0; i--) {
			const e = this.graphState.edges[i];
			if (nodesToDelete.includes(e.from) || nodesToDelete.includes(e.to)) {
				this.graphState.edges.splice(i, 1);
			}
		}

		this.renderer.render();
	}
}

/**
 * DragDropManager - verwaltet Drag & Drop Operationen
 */
class DragDropManager {
	constructor(blockManager) {
		this.blockManager = blockManager;
	}

	setupDraggables(draggables) {
		draggables.forEach(draggable => {
			draggable.addEventListener('dragstart', (e) => {
				e.dataTransfer.setData('type', draggable.dataset.type);
				e.dataTransfer.effectAllowed = 'copy';
			});
		});
	}

	setupDropZone(zone, edgeIndex) {
		zone.addEventListener('dragover', (e) => {
			e.preventDefault();
			zone.classList.add('active');
		});

		zone.addEventListener('dragleave', () => {
			zone.classList.remove('active');
		});

		zone.addEventListener('drop', (e) => {
			e.preventDefault();
			e.stopPropagation();
			zone.classList.remove('active');
			const type = e.dataTransfer.getData('type');
			if (type) {
				this.blockManager.addBlock(type, edgeIndex);
			}
		});
	}

	setupAllDropZones() {
		document.querySelectorAll('.insertion-drop-zone').forEach(zone => {
			const edgeFrom = zone.dataset.edgeFrom;
			const edgeTo = zone.dataset.edgeTo;
			if (edgeFrom && edgeTo) {
				const edgeIndex = this.blockManager.graphState.findEdge(edgeFrom, edgeTo);
				if (edgeIndex !== -1) {
					this.setupDropZone(zone, edgeIndex);
				}
			}
		});
	}
}

// =====================================================================
// Main Application
// =====================================================================
document.addEventListener('DOMContentLoaded', () => {
	const draggables = document.querySelectorAll('.draggable-item');
	const canvas = document.getElementById('canvas');

	// Initialize OOP components
	const graphState = new GraphState();
	const renderer = new Renderer(graphState, canvas);
	const blockManager = new BlockManager(graphState, renderer);
	const dragDropManager = new DragDropManager(blockManager);

	// Setup draggables
	dragDropManager.setupDraggables(draggables);

	// Initial render
	renderer.render();

	// Setup drop zones after each render
	const originalRender = renderer.render.bind(renderer);
	renderer.render = function() {
		originalRender();
		setTimeout(() => dragDropManager.setupAllDropZones(), 10);
	};

	// Context Menu Setup
	const contextMenu = document.createElement('div');
	contextMenu.className = 'context-menu';
	contextMenu.style.display = 'none';
	contextMenu.style.position = 'absolute';
	contextMenu.style.backgroundColor = 'white';
	contextMenu.style.border = '1px solid #ccc';
	contextMenu.style.padding = '5px';
	contextMenu.style.zIndex = '1000';
	contextMenu.style.boxShadow = '2px 2px 5px rgba(0,0,0,0.2)';
	contextMenu.innerHTML = `
		<div class="menu-item" id="cm-add-case" style="display:none; cursor: pointer; padding: 5px 10px;">Add Case</div>
		<div class="menu-item" id="cm-move"   style="cursor: pointer; padding: 5px 10px;">&#x2B0C; Move Block</div>
		<div class="menu-item" id="cm-delete" style="cursor: pointer; padding: 5px 10px; color:#c0392b;">&#x1F5D1; Delete Block</div>
	`;
	document.body.appendChild(contextMenu);

	let currentBlockId = null;
	let currentCaseBranchId = null;

	document.addEventListener('contextmenu', (e) => {
		const block = e.target.closest('.nsd-block');
		const caseBranch = e.target.closest('.block-case-branch');

		if (block) {
			e.preventDefault();
			currentBlockId = block.dataset.id;
			currentCaseBranchId = caseBranch ? caseBranch.dataset.caseId : null;

			const type = block.classList.contains('block-case') ? 'case' : 'other';

			const addBtn = document.getElementById('cm-add-case');
			if (type === 'case') {
				addBtn.style.display = 'block';
			} else {
				addBtn.style.display = 'none';
			}

			contextMenu.style.left = `${e.pageX}px`;
			contextMenu.style.top = `${e.pageY}px`;
			contextMenu.style.display = 'block';
		} else {
			contextMenu.style.display = 'none';
		}
	});

	document.addEventListener('click', (e) => {
		contextMenu.style.display = 'none';

		if (blockManager.moveSourceId) {
			const zone = e.target.closest('.insertion-drop-zone');
			if (zone && zone.dataset.edgeFrom && zone.dataset.edgeTo) {
				e.stopPropagation();
				blockManager.moveBlock(blockManager.moveSourceId, zone.dataset.edgeFrom, zone.dataset.edgeTo);
			} else {
				blockManager.exitMoveMode();
			}
		}
	});

	document.getElementById('cm-delete').addEventListener('click', (e) => {
		e.stopPropagation();
		if (currentBlockId) {
			blockManager.deleteBlock(currentBlockId);
			contextMenu.style.display = 'none';
		}
	});

	document.getElementById('cm-add-case').addEventListener('click', (e) => {
		e.stopPropagation();
		if (currentBlockId) {
			blockManager.addCaseOption(currentBlockId);
			contextMenu.style.display = 'none';
		}
	});

	document.getElementById('cm-move').addEventListener('click', (e) => {
		if (currentBlockId) {
			e.stopPropagation();
			contextMenu.style.display = 'none';
			blockManager.enterMoveMode(currentBlockId);
		}
	});

	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && blockManager.moveSourceId) {
			blockManager.exitMoveMode();
		}
	});

	// Make blockManager and graphState globally accessible for updateMermaid function
	window.editorState = {
		graphState: graphState,
		blockManager: blockManager,
		renderer: renderer
	};
});

// =====================================================================
// Global Helper Functions (for compatibility with existing code)
// =====================================================================

function updateMermaid() {
	const mermaidCode = generateMermaid();
	document.getElementById('mermaid-output').textContent = mermaidCode;
}

function generateMermaid() {
	if (!window.editorState) return '';
	
	const graphState = window.editorState.graphState;
	let code = 'flowchart TD\n';

	code += 'classDef default fill:#fff,stroke:#000,stroke-width:1px;\n';
	code += 'classDef join fill:#fff,stroke:#000,stroke-width:0px;\n';

	const visited = new Set();
	const queue = ['start_node_id'];
	const nodesToRender = new Set();

	visited.add('start_node_id');

	while (queue.length > 0) {
		const nodeId = queue.shift();
		nodesToRender.add(nodeId);

		const outEdges = graphState.edges.filter(e => e.from === nodeId);

		outEdges.forEach(edge => {
			if (!visited.has(edge.to)) {
				visited.add(edge.to);
				queue.push(edge.to);
			}
		});
	}

	nodesToRender.forEach(nodeId => {
		const node = graphState.getNode(nodeId);
		if (!node) return;
		if (node.type === 'join') return;

		let label = node.text ? node.text.replace(/"/g, "'") : "";

		if (node.type === 'start') code += `${node.id}([Start])\n`;
		else if (node.type === 'end') code += `${node.id}([End])\n`;
		else if (node.type === 'if_else' || node.type === 'case') code += `${node.id}{"${label}"}\n`;
		else if (['for_loop', 'while_loop', 'repeat_loop'].includes(node.type)) code += `${node.id}(["${label}"])\n`;
		else code += `${node.id}["${label}"]\n`;
	});

	function resolveSuccessor(nodeId, initialLabel) {
		let currentId = nodeId;
		let label = initialLabel;
		const visitedPath = new Set([nodeId]);

		while (true) {
			const successors = graphState.edges.filter(e => e.from === currentId).map(e => e.to);
			if (successors.length === 0) return null;

			const nextId = successors[0];
			const nextNode = graphState.getNode(nextId);

			if (!nextNode) return null;

			if (nextNode.type !== 'join') {
				return { id: nextId, label: label };
			}

			if (visitedPath.has(nextId)) return null;
			visitedPath.add(nextId);
			currentId = nextId;
		}
	}

	nodesToRender.forEach(nodeId => {
		const node = graphState.getNode(nodeId);
		if (!node || node.type === 'join') return;

		const successors = graphState.getSuccessors(nodeId);
		successors.forEach(succId => {
			const edge = graphState.getEdge(nodeId, succId);
			const edgeLabel = edge ? edge.label : "";

			const succNode = graphState.getNode(succId);

			if (succNode && succNode.type === 'join') {
				const resolved = resolveSuccessor(succId, edgeLabel);
				if (resolved) {
					let labelStr = resolved.label ? `|${resolved.label}|` : "";
					code += `${nodeId} -->${labelStr} ${resolved.id}\n`;
				}
			} else {
				let labelStr = edgeLabel ? `|${edgeLabel}|` : "";
				code += `${nodeId} -->${labelStr} ${succId}\n`;
			}
		});
	});

	return code;
}

function updateAllIfElseBlocks() {
	const allIfBlocks = document.querySelectorAll('.block-if');
	console.log('[UPDATE-ALL] Found', allIfBlocks.length, 'If/Else blocks');

	allIfBlocks.forEach(blockEl => {
		const header = blockEl.querySelector('.block-if-header');
		const body = blockEl.querySelector('.block-if-body');
		const svg = header?.querySelector('.if-svg');

		if (!svg || !body || !header) return;

		const totalWidth = body.offsetWidth;
		if (totalWidth === 0) return;

		const branches = Array.from(body.children).filter(child => child.classList.contains('block-if-branch'));
		if (branches.length !== 2) return;

		const trueBranchWidth = branches[0].offsetWidth;
		const centerPercent = (trueBranchWidth / totalWidth) * 100;

		console.log('[UPDATE-ALL] Block width:', totalWidth, 'True:', trueBranchWidth, 'Center:', centerPercent);

		const lines = Array.from(svg.querySelectorAll('line'));
		const leftLine = lines.find(l => l.getAttribute('x1') === "0" && l.getAttribute('y1') === "0");
		const rightLine = lines.find(l => l.getAttribute('x1') === "100" && l.getAttribute('y1') === "0");

		if (leftLine) {
			leftLine.setAttribute("x2", centerPercent);
		}
		if (rightLine) {
			rightLine.setAttribute("x2", centerPercent);
		}

		const textContainer = header.querySelector('.if-condition-text');
		if (textContainer) {
			const textCenterPercent = (50 + centerPercent) / 2;
			textContainer.style.left = textCenterPercent + '%';
			textContainer.style.transform = 'translateX(-50%)';
			textContainer.style.width = 'auto';
		}
	});
}

function observeIfResize(container, header, body) {
	const svg = header.querySelector('.if-svg');
	if (!svg) {
		console.log('[IF-RESIZE] No SVG found');
		return;
	}

	const updateLines = () => {
		if (!body || !header) {
			console.log('[IF-RESIZE] No body or header');
			return;
		}
		const totalWidth = body.offsetWidth;
		if (totalWidth === 0) {
			console.log('[IF-RESIZE] Total width is 0');
			return;
		}

		const branches = Array.from(body.children).filter(child => child.classList.contains('block-if-branch'));
		if (branches.length !== 2) {
			console.log('[IF-RESIZE] Branch count is not 2:', branches.length);
			return;
		}

		const trueBranch = branches[0];
		const falseBranch = branches[1];
		const trueBranchWidth = trueBranch.offsetWidth;
		const falseBranchWidth = falseBranch.offsetWidth;

		const centerPercent = (trueBranchWidth / totalWidth) * 100;

		console.log('[IF-RESIZE] Total width:', totalWidth, 'True:', trueBranchWidth, 'False:', falseBranchWidth, 'Center%:', centerPercent);

		const lines = Array.from(svg.querySelectorAll('line'));
		const leftLine = lines.find(l => l.getAttribute('x1') === "0" && l.getAttribute('y1') === "0");
		const rightLine = lines.find(l => l.getAttribute('x1') === "100" && l.getAttribute('y1') === "0");

		console.log('[IF-RESIZE] Left line found:', !!leftLine, 'Right line found:', !!rightLine);

		if (leftLine) {
			leftLine.setAttribute("x2", centerPercent);
			console.log('[IF-RESIZE] Updated left line x2 to:', centerPercent);
		}
		if (rightLine) {
			rightLine.setAttribute("x2", centerPercent);
			console.log('[IF-RESIZE] Updated right line x2 to:', centerPercent);
		}

		const textContainer = header.querySelector('.if-condition-text');
		if (textContainer) {
			const textCenterPercent = (50 + centerPercent) / 2;
			textContainer.style.left = textCenterPercent + '%';
			textContainer.style.transform = 'translateX(-50%)';
			textContainer.style.width = 'auto';
			console.log('[IF-RESIZE] Updated text position to:', textCenterPercent + '%');
		}
	};

	console.log('[IF-RESIZE] Setting up observer');
	const observer = new ResizeObserver(updateLines);
	observer.observe(body);

	body.querySelectorAll('.block-if-branch').forEach(branch => {
		observer.observe(branch);
	});

	setTimeout(updateLines, 50);
}

function observeCaseResize(container, header, body) {
	const svg = header.querySelector('.case-svg');
	if (!svg) return;

	const updateLines = () => {
		if (!body || !header) return;
		const totalWidth = body.offsetWidth;
		if (totalWidth === 0) return;

		const branches = Array.from(body.querySelectorAll('.block-case-branch'));
		let currentX = 0;
		const splitY = 60;

		branches.forEach((branch, index) => {
			const branchWidth = branch.offsetWidth;
			currentX += branchWidth;

			if (index < branches.length - 1) {
				const percent = (currentX / totalWidth) * 100;
				const sepIndex = index + 1;
				const line = svg.querySelector(`line[data-sep-index="${sepIndex}"]`);
				if (line) {
					line.setAttribute("x1", percent + "%");
					line.setAttribute("x2", percent + "%");
				}
			}

			const labelDiv = header.querySelector(`.case-header-label[data-index="${index}"]`);
			if (labelDiv) {
				const branchLeft = currentX - branchWidth;
				const leftPercent = (branchLeft / totalWidth) * 100;
				const widthPercent = (branchWidth / totalWidth) * 100;

				labelDiv.style.left = leftPercent + "%";
				labelDiv.style.width = widthPercent + "%";
			}
		});

		if (branches.length >= 2) {
			const width0 = branches[0].offsetWidth;
			const p0 = (width0 / totalWidth) * 100;

			const lines = Array.from(svg.querySelectorAll('line'));
			const diagonals = lines.filter(l => !l.hasAttribute('data-sep-index') && l.getAttribute('stroke') === 'black');

			const diagL = lines.find(l => l.getAttribute('x1') === "0" && l.getAttribute('y1') === "0");
			const diagR = lines.find(l => l.getAttribute('x1') === "100" && l.getAttribute('y1') === "0");
			const horiz = lines.find(l => !l.hasAttribute('data-sep-index') && l.getAttribute('y1') !== "0" && l.getAttribute('x1') !== l.getAttribute('x2'));

			if (diagL) {
				diagL.setAttribute("x2", p0 + "%");
			}

			let widthLast = branches[branches.length - 1].offsetWidth;
			let pLast = 100 - (widthLast / totalWidth) * 100;

			if (diagR) {
				diagR.setAttribute("x2", pLast + "%");
			}

			if (horiz && diagL && diagR) {
				horiz.setAttribute("x1", p0 + "%");
				horiz.setAttribute("x2", pLast + "%");
			}
		}
	};

	const observer = new ResizeObserver(updateLines);
	observer.observe(body);

	setTimeout(updateLines, 50);
}
