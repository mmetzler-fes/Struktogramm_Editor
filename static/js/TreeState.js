'use strict';

// Interne Hilfsfunktion – bidirektionale BFS zum Finden des Merge-Knotens
function _findMerge(edgeMap, id1, id2, forbidden) {
	if (!id1 || !id2) return null;
	const v1 = new Set(), v2 = new Set();
	const q1 = [id1], q2 = [id2];
	for (let i = 0; i < 2000 && (q1.length || q2.length); i++) {
		if (q1.length) {
			const n = q1.shift();
			if (v2.has(n)) return n;
			if (!v1.has(n)) { v1.add(n); (edgeMap[n] || []).forEach(e => { if (e.to !== forbidden) q1.push(e.to); }); }
		}
		if (q2.length) {
			const n = q2.shift();
			if (v1.has(n)) return n;
			if (!v2.has(n)) { v2.add(n); (edgeMap[n] || []).forEach(e => { if (e.to !== forbidden) q2.push(e.to); }); }
		}
	}
	return null;
}

/**
 * TreeState – Primäres Datenmodell für ein Struktogramm.
 *
 * Knoten-Typen:
 *   Einfach:  { id, type, text }
 *   Loop:     { id, type, text, children: [] }
 *   If/Else:  { id, type, text, branches: [{label, children}, {label, children}] }
 *   Case:     { id, type, text, branches: [{label, children}, ...] }
 *
 * this.root ist ein Array von Knoten (oberste Sequenz).
 */
export class TreeState {
	constructor() {
		this.root = [];
	}

	// ── Traversierung ─────────────────────────────────────────

	findNode(id, list, parent) {
		if (list === undefined) list = this.root;
		if (parent === undefined) parent = null;

		for (let i = 0; i < list.length; i++) {
			const node = list[i];
			if (node.id === id) return { node, indexInParent: i, listRef: list };
			const result = this._searchIn(id, node);
			if (result) return result;
		}
		return null;
	}

	_searchIn(id, node) {
		if (node.children) {
			for (let i = 0; i < node.children.length; i++) {
				if (node.children[i].id === id) return { node: node.children[i], indexInParent: i, listRef: node.children };
				const r = this._searchIn(id, node.children[i]);
				if (r) return r;
			}
		}
		if (node.branches) {
			for (const branch of node.branches) {
				for (let i = 0; i < branch.children.length; i++) {
					if (branch.children[i].id === id) return { node: branch.children[i], indexInParent: i, listRef: branch.children };
					const r = this._searchIn(id, branch.children[i]);
					if (r) return r;
				}
			}
		}
		return null;
	}

	/** Gibt die Zielsequenz zurück: root, Loop-children oder Branch-children. */
	getSequence(containerId, branchIndex) {
		if (containerId === null) return this.root;
		const found = this.findNode(containerId);
		if (!found) return null;
		const node = found.node;
		if (branchIndex !== null && branchIndex !== undefined) {
			if (node.branches && node.branches[branchIndex]) return node.branches[branchIndex].children;
			return null;
		}
		if (node.children !== undefined) return node.children;
		return null;
	}

	// ── Operationen ───────────────────────────────────────────

	insertNode(node, containerId, branchIndex, insertIndex) {
		const seq = this.getSequence(containerId, branchIndex);
		if (!seq) { console.error('[TREE] insertNode: Sequenz nicht gefunden', containerId, branchIndex); return false; }
		seq.splice(insertIndex, 0, node);
		return true;
	}

	removeNode(id) {
		const found = this.findNode(id);
		if (!found) { console.error('[TREE] removeNode: nicht gefunden', id); return null; }
		found.listRef.splice(found.indexInParent, 1);
		return found.node;
	}

	/**
	 * Verschiebt Knoten id an target = { containerId, branchIndex, insertIndex }.
	 * Korrekte Index-Anpassung wenn Quelle und Ziel in derselben Sequenz liegen.
	 */
	moveNode(id, target) {
		const found = this.findNode(id);
		if (!found) { console.error('[TREE] moveNode: Quelle nicht gefunden', id); return false; }

		if (this._isDescendantOrSelf(found.node, target.containerId)) {
			alert('Ein Block kann nicht in sich selbst verschoben werden.');
			return false;
		}

		const targetSeq = this.getSequence(target.containerId, target.branchIndex);
		if (!targetSeq) { console.error('[TREE] moveNode: Zielsequenz nicht gefunden', target); return false; }

		let insertIndex = target.insertIndex;
		if (found.listRef === targetSeq && found.indexInParent < insertIndex) insertIndex--;

		found.listRef.splice(found.indexInParent, 1);
		targetSeq.splice(insertIndex, 0, found.node);
		return true;
	}

	_isDescendantOrSelf(node, targetId) {
		if (targetId === null) return false;
		if (node.id === targetId) return true;
		if (node.children) for (const c of node.children) if (this._isDescendantOrSelf(c, targetId)) return true;
		if (node.branches) for (const b of node.branches) for (const c of b.children) if (this._isDescendantOrSelf(c, targetId)) return true;
		return false;
	}

	// ── Serialisierung ────────────────────────────────────────

	/** Exportiert als { nodes, edges } (Graph-Format für Speichern/Export). */
	toGraphFormat() {
		const nodes = [
			{ id: 'start_node_id', type: 'start', text: 'Start' },
			{ id: 'end_node_id',   type: 'end',   text: 'End'   }
		];
		const edges = [];
		this._serializeSeq(this.root, 'start_node_id', 'end_node_id', nodes, edges);
		return { nodes, edges };
	}

	_serializeSeq(seq, entryId, exitId, nodes, edges, isBackEdge) {
		let prevId = entryId;
		let prevNodeIsLoop = false;
		for (const node of seq) {
			this._serializeNode(node, nodes, edges);
			const edgeToCurrent = { from: prevId, to: node.id };
			if (prevNodeIsLoop) edgeToCurrent.label = 'Exit';
			edges.push(edgeToCurrent);
			prevId = this._nodeExitId(node);
			prevNodeIsLoop = ['for_loop', 'while_loop', 'repeat_loop'].includes(node.type);
		}
		const lastEdge = { from: prevId, to: exitId };
		if (!isBackEdge && prevNodeIsLoop) lastEdge.label = 'Exit';
		edges.push(lastEdge);
	}

	_nodeExitId(node) {
		if (['for_loop', 'while_loop', 'repeat_loop'].includes(node.type)) return node.id;
		if (node.type === 'if_else' || node.type === 'case') return node.id + '_merge';
		return node.id;
	}

	_serializeSeqBack(seq, entryId, exitId, nodes, edges) {
		this._serializeSeq(seq, entryId, exitId, nodes, edges, true);
	}

	_serializeNode(node, nodes, edges) {
		const nd = { id: node.id, type: node.type, text: node.text };
		if (node.subRef) nd.subRef = node.subRef;
		nodes.push(nd);

		if (['for_loop', 'while_loop', 'repeat_loop'].includes(node.type)) {
			const bodyDummy = node.id + '_body_dummy';
			nodes.push({ id: bodyDummy, type: 'join', text: ' ' });
			edges.push({ from: node.id, to: bodyDummy });
			this._serializeSeqBack(node.children || [], bodyDummy, node.id, nodes, edges);
			return node.id;

		} else if (node.type === 'if_else') {
			const mergeId = node.id + '_merge';
			const trueId  = node.id + '_true_dummy';
			const falseId = node.id + '_false_dummy';
			nodes.push({ id: mergeId, type: 'join', text: ' ' });
			nodes.push({ id: trueId,  type: 'join', text: ' ' });
			nodes.push({ id: falseId, type: 'join', text: ' ' });
			edges.push({ from: node.id, to: trueId,  label: 'Ja'   });
			edges.push({ from: node.id, to: falseId, label: 'Nein' });
			const trueBranch  = (node.branches && node.branches[0]) ? node.branches[0].children : [];
			const falseBranch = (node.branches && node.branches[1]) ? node.branches[1].children : [];
			this._serializeSeq(trueBranch,  trueId,  mergeId, nodes, edges);
			this._serializeSeq(falseBranch, falseId, mergeId, nodes, edges);
			return mergeId;

		} else if (node.type === 'case') {
			const mergeId = node.id + '_merge';
			nodes.push({ id: mergeId, type: 'join', text: ' ' });
			(node.branches || []).forEach((branch, idx) => {
				const dummyId = node.id + '_case_' + idx;
				nodes.push({ id: dummyId, type: 'join', text: ' ' });
				edges.push({ from: node.id, to: dummyId, label: branch.label });
				this._serializeSeq(branch.children, dummyId, mergeId, nodes, edges);
			});
			return mergeId;
		}

		return node.id;
	}

	// ── Import ────────────────────────────────────────────────

	static fromGraphFormat(data) {
		const state = new TreeState();
		if (!data.nodes || !data.edges) return state;

		const nodeMap = {};
		data.nodes.forEach(n => { nodeMap[n.id] = n; });

		const edgeMap = {};
		data.edges.forEach(e => {
			if (!edgeMap[e.from]) edgeMap[e.from] = [];
			edgeMap[e.from].push({ to: e.to, label: e.label || '' });
		});

		const getSuccs = id => edgeMap[id] || [];

		const parseSeq = (startId, stopId, visited) => {
			if (!visited) visited = new Set();
			const seq = [];
			let cur = startId;

			while (cur && cur !== stopId) {
				if (visited.has(cur)) break;
				visited.add(cur);

				const node = nodeMap[cur];
				if (!node) break;

				if (node.type === 'join') {
					const s = getSuccs(cur);
					cur = s.length > 0 ? s[0].to : null;
					continue;
				}

				const succs = getSuccs(cur);

				if (['for_loop', 'while_loop', 'repeat_loop'].includes(node.type)) {
					const exitSucc = succs.find(s => s.label.toLowerCase().includes('exit'));
					const bodySucc = succs.find(s => !s.label.toLowerCase().includes('exit'));
					const treeNode = { id: node.id, type: node.type, text: node.text, children: [] };
					if (bodySucc) treeNode.children = parseSeq(bodySucc.to, cur, new Set(visited));
					seq.push(treeNode);
					cur = exitSucc ? exitSucc.to : null;

				} else if (node.type === 'if_else') {
					const mergeId  = _findMerge(edgeMap, succs[0] ? succs[0].to : null, succs[1] ? succs[1].to : null, cur);
					const mergeSuccs = mergeId ? getSuccs(mergeId) : [];
					const trueSrc  = succs.find(s => { const l = s.label.toLowerCase(); return l.includes('ja') || l.includes('yes') || l.includes('true'); });
					const falseSrc = succs.find(s => s !== trueSrc);
					const treeNode = {
						id: node.id, type: node.type, text: node.text,
						branches: [
							{ label: trueSrc  ? trueSrc.label  : 'Ja',   children: trueSrc  ? parseSeq(trueSrc.to,  mergeId, new Set(visited)) : [] },
							{ label: falseSrc ? falseSrc.label : 'Nein', children: falseSrc ? parseSeq(falseSrc.to, mergeId, new Set(visited)) : [] }
						]
					};
					seq.push(treeNode);
					cur = mergeId ? (mergeSuccs[0] ? mergeSuccs[0].to : null) : null;

				} else if (node.type === 'case') {
					const mergeId = succs.length >= 2
						? _findMerge(edgeMap, succs[0].to, succs[1].to, cur)
						: (succs.length === 1 ? (getSuccs(succs[0].to)[0] || {}).to : null);
					const mergeSuccs = mergeId ? getSuccs(mergeId) : [];
					const branches = succs.map(s => ({ label: s.label, children: parseSeq(s.to, mergeId, new Set(visited)) }));
					seq.push({ id: node.id, type: node.type, text: node.text, branches });
					cur = mergeId ? (mergeSuccs[0] ? mergeSuccs[0].to : null) : null;

				} else {
					const nd = { id: node.id, type: node.type, text: node.text };
					if (node.subRef) nd.subRef = node.subRef;
					seq.push(nd);
					cur = succs.length > 0 ? succs[0].to : null;
				}
			}
			return seq;
		};

		const startSuccs = getSuccs('start_node_id');
		const firstId = startSuccs.length > 0 ? startSuccs[0].to : null;
		if (firstId && firstId !== 'end_node_id') state.root = parseSeq(firstId, 'end_node_id');
		return state;
	}
}
