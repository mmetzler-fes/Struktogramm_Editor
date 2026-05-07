// =====================================================================
// Struktogramm Editor — Baum-basierte Architektur
// =====================================================================
// Primäres Datenmodell: Baumstruktur (TreeState)
// Der Graph (Kanten/Knoten-Format) wird nur für Save/Export abgeleitet.
// =====================================================================

// ========================
// ID Generator
// ========================
function generateId() {
return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ========================
// TreeState
// ========================
/**
 * TreeState verwaltet das Struktogramm als echte Baumstruktur.
 *
 * Knoten-Typen:
 *   Einfach: { id, type, text }
 *   Loop:    { id, type, text, children: [] }
 *   If/Else: { id, type, text, branches: [{label, children}, {label, children}] }
 *   Case:    { id, type, text, branches: [{label, children}, ...] }
 *
 * this.root ist ein Array von Knoten (oberste Sequenz).
 */
class TreeState {
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

/** Gibt die Zielsequenz zurück: root, Loop-children, oder Branch-children. */
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
// Index-Korrektur: wenn Quelle und Ziel dieselbe Liste sind und Quellindex < Zielindex
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
{ id: 'end_node_id', type: 'end', text: 'End' }
];
const edges = [];
this._serializeSeq(this.root, 'start_node_id', 'end_node_id', nodes, edges);
return { nodes, edges };
}

/**
 * Serialisiert eine Sequenz.
 * isBackEdge=true: die Schlusskante bekommt NIE ein Exit-Label
 *                  (für Loop-Body-Rückkante zum Loop-Kopf).
 */
_serializeSeq(seq, entryId, exitId, nodes, edges, isBackEdge) {
let prevId = entryId;
let prevNodeIsLoop = false;
for (const node of seq) {
this._serializeNode(node, nodes, edges);
const edgeToCurrent = { from: prevId, to: node.id };
if (prevNodeIsLoop) edgeToCurrent.label = 'Exit';
edges.push(edgeToCurrent);
prevId = this._nodeExitId(node);
prevNodeIsLoop = ['for_loop','while_loop','repeat_loop'].includes(node.type);
}
const lastEdge = { from: prevId, to: exitId };
if (!isBackEdge && prevNodeIsLoop) lastEdge.label = 'Exit';
edges.push(lastEdge);
}

/** Gibt die ID zurück, von der aus der "nächste" Knoten erreicht wird. */
_nodeExitId(node) {
if (['for_loop','while_loop','repeat_loop'].includes(node.type)) return node.id;
if (node.type === 'if_else' || node.type === 'case') return node.id + '_merge';
return node.id;
}

/**
 * Wie _serializeSeqBack, aber die Schlusskante bekommt KEIN Exit-Label.
 * Wird für Loop-Body-Sequenzen verwendet (Rückkante zum Loop-Kopf).
 */
_serializeSeqBack(seq, entryId, exitId, nodes, edges) {
this._serializeSeq(seq, entryId, exitId, nodes, edges, true /* isBackEdge */);
}

_serializeNode(node, nodes, edges) {
nodes.push({ id: node.id, type: node.type, text: node.text });

if (['for_loop', 'while_loop', 'repeat_loop'].includes(node.type)) {
const bodyDummy = node.id + '_body_dummy';
nodes.push({ id: bodyDummy, type: 'join', text: ' ' });
edges.push({ from: node.id, to: bodyDummy });
// Body-Sequenz: läuft von bodyDummy zurück zum Loop-Kopf
// Die Rückkante bekommt KEIN Exit-Label (Exit-Label gehört nur auf die Kante loop → Nachfolger)
this._serializeSeqBack(node.children || [], bodyDummy, node.id, nodes, edges);
// Exit-Kante (loop → Nachfolger) wird vom Aufrufer (_serializeSeq) mit Label 'Exit' gesetzt
return node.id;

} else if (node.type === 'if_else') {
const mergeId = node.id + '_merge';
const trueId = node.id + '_true_dummy';
const falseId = node.id + '_false_dummy';
nodes.push({ id: mergeId, type: 'join', text: ' ' });
nodes.push({ id: trueId, type: 'join', text: ' ' });
nodes.push({ id: falseId, type: 'join', text: ' ' });
edges.push({ from: node.id, to: trueId, label: 'Ja' });
edges.push({ from: node.id, to: falseId, label: 'Nein' });
const trueBranch = (node.branches && node.branches[0]) ? node.branches[0].children : [];
const falseBranch = (node.branches && node.branches[1]) ? node.branches[1].children : [];
this._serializeSeq(trueBranch, trueId, mergeId, nodes, edges);
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

// Join-Knoten überspringen
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
const mergeId = _findMerge(edgeMap, succs[0] ? succs[0].to : null, succs[1] ? succs[1].to : null, cur);
const mergeSuccs = mergeId ? getSuccs(mergeId) : [];
const trueSrc = succs.find(s => { const l = s.label.toLowerCase(); return l.includes('ja') || l.includes('yes') || l.includes('true'); });
const falseSrc = succs.find(s => s !== trueSrc);
const treeNode = {
id: node.id, type: node.type, text: node.text,
branches: [
{ label: trueSrc ? trueSrc.label : 'Ja', children: trueSrc ? parseSeq(trueSrc.to, mergeId, new Set(visited)) : [] },
{ label: falseSrc ? falseSrc.label : 'Nein', children: falseSrc ? parseSeq(falseSrc.to, mergeId, new Set(visited)) : [] }
]
};
seq.push(treeNode);
cur = mergeId ? (mergeSuccs[0] ? mergeSuccs[0].to : null) : null;

} else if (node.type === 'case') {
const mergeId = succs.length >= 2 ? _findMerge(edgeMap, succs[0].to, succs[1].to, cur) : (succs.length === 1 ? (getSuccs(succs[0].to)[0] || {}).to : null);
const mergeSuccs = mergeId ? getSuccs(mergeId) : [];
const branches = succs.map(s => ({ label: s.label, children: parseSeq(s.to, mergeId, new Set(visited)) }));
seq.push({ id: node.id, type: node.type, text: node.text, branches });
cur = mergeId ? (mergeSuccs[0] ? mergeSuccs[0].to : null) : null;

} else {
seq.push({ id: node.id, type: node.type, text: node.text });
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

// ── Graph-Import Hilfsfunktion ────────────────────────────────
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

// ========================
// BlockFactory
// ========================
class BlockFactory {
static getDefaultText(type) {
const d = { command:'Do something', if_else:'Bedingung', for_loop:'i = 0 to 10', while_loop:'while condition', repeat_loop:'until condition', subprogram:'Subprogram Name', case:'switch' };
return d[type] || type;
}

static createNode(type) {
const id = generateId();
const text = this.getDefaultText(type);
if (['for_loop', 'while_loop', 'repeat_loop'].includes(type)) return { id, type, text, children: [] };
if (type === 'if_else') return { id, type, text, branches: [{ label: 'Ja', children: [] }, { label: 'Nein', children: [] }] };
if (type === 'case') return { id, type, text, branches: [{ label: '1', children: [] }, { label: '2', children: [] }, { label: 'Default', children: [] }] };
return { id, type, text };
}
}

// ========================
// BlockManager
// ========================
class BlockManager {
constructor(treeState, renderer) {
this.treeState = treeState;
this.renderer = renderer;
this.moveSourceId = null;
this._setupMoveIndicator();
}

_setupMoveIndicator() {
this.moveIndicator = document.createElement('div');
this.moveIndicator.id = 'move-indicator';
document.body.appendChild(this.moveIndicator);
}

addBlock(type, target) {
const node = BlockFactory.createNode(type);
this.treeState.insertNode(node, target.containerId, target.branchIndex, target.insertIndex);
this.renderer.render();
}

deleteBlock(id) {
this.treeState.removeNode(id);
this.renderer.render();
}

moveBlock(id, target) {
const success = this.treeState.moveNode(id, target);
this.exitMoveMode();
if (success) this.renderer.render();
}

enterMoveMode(blockId) {
this.moveSourceId = blockId;
document.body.classList.add('move-mode');
document.querySelectorAll('.nsd-block').forEach(el => {
if (el.dataset.id === blockId) el.classList.add('move-source');
});
const found = this.treeState.findNode(blockId);
const label = found ? `"${found.node.text}"` : 'Block';
this.moveIndicator.textContent = `\u{1F4CD} Move-Modus: ${label} — Zielposition anklicken  |  Esc = Abbrechen`;
this.moveIndicator.style.display = 'block';
}

exitMoveMode() {
this.moveSourceId = null;
document.body.classList.remove('move-mode');
document.querySelectorAll('.move-source').forEach(el => el.classList.remove('move-source'));
this.moveIndicator.style.display = 'none';
}

addCaseOption(blockId) {
const found = this.treeState.findNode(blockId);
if (!found || found.node.type !== 'case') return;
const branches = found.node.branches;
const defaultIdx = branches.findIndex(b => b.label.toLowerCase() === 'default');
const newBranch = { label: String(branches.length), children: [] };
if (defaultIdx !== -1) branches.splice(defaultIdx, 0, newBranch);
else branches.push(newBranch);
this.renderer.render();
}

deleteCaseOption(blockId, branchIndex) {
const found = this.treeState.findNode(blockId);
if (!found || found.node.type !== 'case') return;
if (found.node.branches.length <= 2) { alert('Mindestens 2 Fälle erforderlich.'); return; }
found.node.branches.splice(branchIndex, 1);
this.renderer.render();
}
}

// ========================
// Renderer
// ========================
class Renderer {
constructor(treeState, canvas) {
this.treeState = treeState;
this.canvas = canvas;
}

render() {
try {
this.canvas.innerHTML = '';
const container = document.createElement('div');
container.className = 'nsd-container';
this._renderSeq(this.treeState.root, container, null, null);
this.canvas.appendChild(container);
setTimeout(() => {
if (typeof updateMermaid === 'function') updateMermaid();
if (typeof updateAllIfElseBlocks === 'function') updateAllIfElseBlocks();
}, 100);
} catch (e) {
console.error(e);
this.canvas.innerHTML = `<div style="color:red;padding:20px;">Fehler: ${e.message}<br><pre>${e.stack}</pre></div>`;
}
}

// containerId=null → root; branchIndex=null → Loop-children
_renderSeq(seq, parentEl, containerId, branchIndex) {
parentEl.appendChild(this._dropZone(containerId, branchIndex, 0, seq.length === 0));
seq.forEach((node, idx) => {
parentEl.appendChild(this._renderNode(node));
parentEl.appendChild(this._dropZone(containerId, branchIndex, idx + 1, false));
});
}

_dropZone(containerId, branchIndex, insertIndex, isEmpty) {
const z = document.createElement('div');
z.className = 'insertion-drop-zone';
if (isEmpty) {
z.classList.add(containerId === null ? 'initial-zone' : 'empty-container-zone');
z.dataset.placeholder = containerId === null ? 'Drag blocks here to start' : 'Drop here';
}
z.dataset.containerId   = containerId  !== null  ? containerId  : '__root__';
z.dataset.branchIndex   = branchIndex  !== null  ? String(branchIndex)  : '__none__';
z.dataset.insertIndex   = String(insertIndex);
return z;
}

decodeDropZone(zone) {
return {
containerId:  zone.dataset.containerId  === '__root__' ? null : zone.dataset.containerId,
branchIndex:  zone.dataset.branchIndex  === '__none__' ? null : parseInt(zone.dataset.branchIndex, 10),
insertIndex:  parseInt(zone.dataset.insertIndex, 10)
};
}

_renderNode(node) {
const el = document.createElement('div');
let cls = `nsd-block block-${node.type}`;
if (['for_loop','while_loop','repeat_loop'].includes(node.type)) cls += ' block-loop';
else if (node.type === 'if_else') cls += ' block-if';
el.className = cls;
el.dataset.id = node.id;

if (['command','subprogram','exit','process'].includes(node.type)) {
el.textContent = node.text;
this._editable(el, node);
} else if (node.type === 'if_else')  this._renderIfElse(node, el);
else if (['for_loop','while_loop','repeat_loop'].includes(node.type)) this._renderLoop(node, el);
else if (node.type === 'case') this._renderCase(node, el);
return el;
}

_renderIfElse(node, el) {
const header = document.createElement('div');
header.className = 'block-if-header';

const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
svg.setAttribute("class", "if-svg"); svg.setAttribute("viewBox", "0 0 100 100"); svg.setAttribute("preserveAspectRatio", "none");
['0,0,50,100', '100,0,50,100'].forEach(pts => {
const [x1,y1,x2,y2] = pts.split(',');
const l = document.createElementNS("http://www.w3.org/2000/svg", "line");
l.setAttribute("x1",x1); l.setAttribute("y1",y1); l.setAttribute("x2",x2); l.setAttribute("y2",y2);
l.setAttribute("stroke","black"); l.setAttribute("stroke-width","1");
svg.appendChild(l);
});
header.appendChild(svg);

const tc = document.createElement('div');
tc.className = 'if-condition-text'; tc.textContent = node.text;
this._editable(tc, node); header.appendChild(tc);
el.appendChild(header);

const body = document.createElement('div');
body.className = 'block-if-body';
(node.branches || []).forEach((branch, idx) => {
const bEl = document.createElement('div');
bEl.className = 'block-if-branch';
const lbl = document.createElement('div');
lbl.className = 'if-branch-label'; lbl.textContent = branch.label;
bEl.appendChild(lbl);
this._renderSeq(branch.children, bEl, node.id, idx);
body.appendChild(bEl);
});
el.appendChild(body);
setTimeout(() => { if (typeof observeIfResize === 'function') observeIfResize(el, header, body); }, 0);
}

_renderLoop(node, el) {
const isFoot = node.type === 'repeat_loop';
const header = document.createElement('div');
header.className = 'block-loop-header'; header.textContent = node.text;
this._editable(header, node);

const body = document.createElement('div'); body.className = 'block-loop-body';
const spacer = document.createElement('div'); spacer.className = 'loop-spacer'; body.appendChild(spacer);
const content = document.createElement('div'); content.className = 'loop-content';
this._renderSeq(node.children || [], content, node.id, null);
body.appendChild(content);

if (isFoot) { el.appendChild(body); el.appendChild(header); }
else        { el.appendChild(header); el.appendChild(body); }
}

_renderCase(node, el) {
const header = document.createElement('div');
header.className = 'block-case-header'; header.style.position = 'relative';

const tc = document.createElement('div');
tc.style.cssText = 'position:absolute;top:5px;width:100%;text-align:center;z-index:5';
tc.textContent = node.text; this._editable(tc, node); header.appendChild(tc);

const nb = node.branches ? node.branches.length : 0;
const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
svg.setAttribute("class","case-svg"); svg.setAttribute("viewBox","0 0 100 100"); svg.setAttribute("preserveAspectRatio","none");
header.appendChild(svg);
const segW = 100 / nb, splitY = 60;

(node.branches || []).forEach((branch, idx) => {
const ld = document.createElement('div');
ld.className = 'case-header-label'; ld.dataset.index = idx;
ld.style.cssText = `position:absolute;top:${splitY}%;left:${idx*segW}%;width:${segW}%;height:${100-splitY}%;text-align:center;display:flex;align-items:center;justify-content:center;z-index:5`;
ld.textContent = branch.label; ld.contentEditable = true;
ld.addEventListener('blur', e => { branch.label = e.target.textContent; });
ld.addEventListener('click', e => e.stopPropagation());
header.appendChild(ld);
});

const mkLine = (x1,y1,x2,y2,sep) => {
const l = document.createElementNS("http://www.w3.org/2000/svg","line");
l.setAttribute("x1",x1); l.setAttribute("y1",y1); l.setAttribute("x2",x2); l.setAttribute("y2",y2);
l.setAttribute("stroke","black"); l.setAttribute("stroke-width","1");
if (sep !== undefined) l.setAttribute("data-sep-index", sep);
svg.appendChild(l);
};
mkLine("0","0",segW+"%",splitY+"%");
mkLine("100","0",(100-segW)+"%",splitY+"%");
if (nb > 2) {
mkLine(segW+"%",splitY+"%",(100-segW)+"%",splitY+"%");
for (let i = 1; i < nb-1; i++) mkLine((i+1)*segW+"%",splitY+"%",(i+1)*segW+"%","100%",i);
}
el.appendChild(header);

const body = document.createElement('div'); body.className = 'block-case-body';
(node.branches || []).forEach((branch, idx) => {
const bEl = document.createElement('div'); bEl.className = 'block-case-branch';
bEl.dataset.caseId = node.id + '_branch_' + idx;
this._renderSeq(branch.children, bEl, node.id, idx);
body.appendChild(bEl);
});
el.appendChild(body);
setTimeout(() => { if (typeof observeCaseResize === 'function') observeCaseResize(el, header, body); }, 50);
}

_editable(element, node) {
element.contentEditable = true;
element.addEventListener('blur', e => {
node.text = e.target.textContent;
if (typeof updateMermaid === 'function') updateMermaid();
});
element.addEventListener('click', e => e.stopPropagation());
}
}

// ========================
// DragDropManager
// ========================
class DragDropManager {
constructor(blockManager, renderer) {
this.blockManager = blockManager;
this.renderer = renderer;
}

setupDraggables(draggables) {
draggables.forEach(d => {
d.addEventListener('dragstart', e => {
e.dataTransfer.setData('type', d.dataset.type);
e.dataTransfer.effectAllowed = 'copy';
});
});
}

setupAllDropZones() {
document.querySelectorAll('.insertion-drop-zone').forEach(zone => {
const nz = zone.cloneNode(true);
zone.parentNode.replaceChild(nz, zone);
nz.addEventListener('dragover', e => { e.preventDefault(); nz.classList.add('active'); });
nz.addEventListener('dragleave', () => nz.classList.remove('active'));
nz.addEventListener('drop', e => {
e.preventDefault(); e.stopPropagation(); nz.classList.remove('active');
const type = e.dataTransfer.getData('type');
if (type) this.blockManager.addBlock(type, this.renderer.decodeDropZone(nz));
});
});
}
}

// =====================================================================
// Main Application
// =====================================================================
document.addEventListener('DOMContentLoaded', () => {
const draggables = document.querySelectorAll('.draggable-item');
const canvas = document.getElementById('canvas');

const treeState = new TreeState();
const renderer = new Renderer(treeState, canvas);
const blockManager = new BlockManager(treeState, renderer);
const dragDropManager = new DragDropManager(blockManager, renderer);

dragDropManager.setupDraggables(draggables);

const originalRender = renderer.render.bind(renderer);
renderer.render = function () {
originalRender();
setTimeout(() => dragDropManager.setupAllDropZones(), 100);
};

renderer.render();

// ── Context Menu ──────────────────────────────────────────
const contextMenu = document.createElement('div');
contextMenu.className = 'context-menu';
contextMenu.style.cssText = 'display:none;position:absolute;background:white;border:1px solid #ccc;padding:5px;z-index:1000;box-shadow:2px 2px 5px rgba(0,0,0,0.2)';
contextMenu.innerHTML = `
<div class="menu-item" id="cm-add-case" style="display:none;cursor:pointer;padding:5px 10px;">Add Case</div>
<div class="menu-item" id="cm-del-case" style="display:none;cursor:pointer;padding:5px 10px;color:#c0392b;">Delete Case</div>
<div class="menu-item" id="cm-move"     style="cursor:pointer;padding:5px 10px;">&#x2B0C; Move Block</div>
<div class="menu-item" id="cm-delete"   style="cursor:pointer;padding:5px 10px;color:#c0392b;">&#x1F5D1; Delete Block</div>
`;
document.body.appendChild(contextMenu);

let currentBlockId = null;
let currentCaseBranchIndex = null;

document.addEventListener('contextmenu', e => {
const block = e.target.closest('.nsd-block');
if (block) {
e.preventDefault();
currentBlockId = block.dataset.id;
const caseBranch = e.target.closest('.block-case-branch');
if (caseBranch) {
const parts = caseBranch.dataset.caseId.split('_branch_');
currentCaseBranchIndex = parts.length === 2 ? parseInt(parts[1], 10) : null;
} else { currentCaseBranchIndex = null; }

const found = treeState.findNode(currentBlockId);
const isCase = found && found.node.type === 'case';
document.getElementById('cm-add-case').style.display = isCase ? 'block' : 'none';
document.getElementById('cm-del-case').style.display = (isCase && currentCaseBranchIndex !== null) ? 'block' : 'none';
contextMenu.style.left = e.pageX + 'px';
contextMenu.style.top  = e.pageY + 'px';
contextMenu.style.display = 'block';
} else { contextMenu.style.display = 'none'; }
});

document.addEventListener('click', e => {
contextMenu.style.display = 'none';
if (blockManager.moveSourceId) {
const zone = e.target.closest('.insertion-drop-zone');
if (zone && zone.dataset.containerId) {
e.stopPropagation();
blockManager.moveBlock(blockManager.moveSourceId, renderer.decodeDropZone(zone));
} else { blockManager.exitMoveMode(); }
}
});

document.getElementById('cm-delete').addEventListener('click', e => {
e.stopPropagation();
if (currentBlockId) { blockManager.deleteBlock(currentBlockId); contextMenu.style.display = 'none'; }
});
document.getElementById('cm-add-case').addEventListener('click', e => {
e.stopPropagation();
if (currentBlockId) { blockManager.addCaseOption(currentBlockId); contextMenu.style.display = 'none'; }
});
document.getElementById('cm-del-case').addEventListener('click', e => {
e.stopPropagation();
if (currentBlockId !== null && currentCaseBranchIndex !== null) {
blockManager.deleteCaseOption(currentBlockId, currentCaseBranchIndex);
contextMenu.style.display = 'none';
}
});
document.getElementById('cm-move').addEventListener('click', e => {
if (currentBlockId) { e.stopPropagation(); contextMenu.style.display = 'none'; blockManager.enterMoveMode(currentBlockId); }
});

document.addEventListener('keydown', e => {
if (e.key === 'Escape' && blockManager.moveSourceId) blockManager.exitMoveMode();
});

// ── Save / Load ───────────────────────────────────────────
document.getElementById('save-btn').addEventListener('click', () => {
const data = treeState.toGraphFormat();
const a = document.createElement('a');
a.setAttribute("href", "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2)));
a.setAttribute("download", "struktogramm.json");
document.body.appendChild(a); a.click(); a.remove();
});

document.getElementById('load-btn').addEventListener('click', () => document.getElementById('load-file-input').click());

document.getElementById('load-file-input').addEventListener('change', event => {
const file = event.target.files[0]; if (!file) return;
const reader = new FileReader();
reader.onload = e => {
try {
const data = JSON.parse(e.target.result);
if (!data.nodes || !data.edges) throw new Error("Ungültiges Format.");
const loaded = TreeState.fromGraphFormat(data);
treeState.root = loaded.root;
renderer.render();
alert('Diagramm geladen!');
} catch (err) { alert('Fehler: ' + err.message); }
};
reader.readAsText(file);
event.target.value = '';
});

// ── Mermaid / Export ──────────────────────────────────────
document.getElementById('save-mermaid-btn').addEventListener('click', () => {
const a = document.createElement('a');
a.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(generateMermaid()));
a.setAttribute("download", "diagram.mmd");
document.body.appendChild(a); a.click(); a.remove();
});
document.getElementById('export-btn').addEventListener('click', () => {
navigator.clipboard.writeText(generateMermaid()).then(() => alert('Mermaid-Code kopiert!')).catch(err => alert('Fehler: ' + err));
});

function downloadSVG(svg, fn) {
const url = URL.createObjectURL(new Blob([svg], {type:'image/svg+xml'}));
const a = document.createElement('a'); a.href = url; a.download = fn;
document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}
function openExportModal(title, svg, fn) {
document.getElementById('export-title').textContent = title;
document.getElementById('export-preview').innerHTML = svg;
document.getElementById('export-modal').style.display = 'flex';
document.getElementById('download-export-btn').onclick = () => downloadSVG(svg, fn);
}
document.getElementById('close-export-btn').addEventListener('click', () => { document.getElementById('export-modal').style.display = 'none'; });

document.getElementById('export-nsd-btn').addEventListener('click', () => {
const modal = document.getElementById('export-modal'), preview = document.getElementById('export-preview');
document.getElementById('export-title').textContent = 'Struktogramm (NSD)';
preview.innerHTML = 'Generating...'; modal.style.display = 'flex';
fetch('/api/convert_nsd', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({mermaid: generateMermaid()}) })
.then(r => r.json()).then(d => { if (d.svg) openExportModal('Struktogramm (NSD)', d.svg, 'struktogramm.svg'); else preview.innerHTML = 'Error: ' + (d.error||'?'); })
.catch(err => { preview.innerHTML = 'Error: ' + err; });
});

document.getElementById('export-pap-btn').addEventListener('click', async () => {
const modal = document.getElementById('export-modal'), preview = document.getElementById('export-preview');
document.getElementById('export-title').textContent = 'Programmablaufplan (PAP)';
preview.innerHTML = 'Generating...'; modal.style.display = 'flex';
try {
let { svg } = await mermaid.render('mermaid-pap-' + Date.now(), generateMermaid());
const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
doc.querySelectorAll('.node rect,.node polygon,.node circle,.node ellipse').forEach(el => { el.setAttribute('fill','#ffffff'); el.setAttribute('stroke','#000000'); el.setAttribute('stroke-width','1'); });
doc.querySelectorAll('.edgePaths path').forEach(el => { el.setAttribute('stroke','#000000'); el.setAttribute('stroke-width','1'); el.setAttribute('fill','none'); });
doc.querySelectorAll('marker path').forEach(el => { el.setAttribute('fill','#000000'); el.setAttribute('stroke','#000000'); });
doc.querySelectorAll('.edgeLabel rect').forEach(el => { el.setAttribute('fill','#ffffff'); el.setAttribute('stroke','none'); });
doc.querySelectorAll('text,tspan').forEach(el => { el.setAttribute('fill','#000000'); el.setAttribute('stroke','none'); el.setAttribute('text-anchor', el.style.textAnchor||'middle'); });
doc.querySelectorAll('foreignObject').forEach(el => el.remove());
openExportModal('Programmablaufplan (PAP)', new XMLSerializer().serializeToString(doc.documentElement), 'programmablaufplan.svg');
} catch (err) { preview.innerHTML = 'Fehler: ' + err.message; }
});

window.editorState = { treeState, blockManager, renderer };
});

// =====================================================================
// Globale Hilfsfunktionen
// =====================================================================

function updateMermaid() {
const el = document.getElementById('mermaid-output');
if (el) el.textContent = generateMermaid();
}

function generateMermaid() {
if (!window.editorState) return '';
const { treeState } = window.editorState;
const { nodes, edges } = treeState.toGraphFormat();

const nodeMap = {};
nodes.forEach(n => { nodeMap[n.id] = n; });
const fwd = {};
edges.forEach(e => { if (!fwd[e.from]) fwd[e.from] = []; fwd[e.from].push(e); });

const reachable = new Set();
const q = ['start_node_id'];
while (q.length) { const id = q.shift(); if (reachable.has(id)) continue; reachable.add(id); (fwd[id]||[]).forEach(e => q.push(e.to)); }

let code = 'flowchart TD\nclassDef default fill:#fff,stroke:#000,stroke-width:1px;\nclassDef join fill:#fff,stroke:#000,stroke-width:0px;\n';

reachable.forEach(id => {
const n = nodeMap[id]; if (!n || n.type === 'join') return;
const lbl = (n.text||'').replace(/"/g,"'");
if (n.type==='start') code += `${id}([Start])\n`;
else if (n.type==='end') code += `${id}([End])\n`;
else if (n.type==='if_else'||n.type==='case') code += `${id}{"${lbl}"}\n`;
else if (['for_loop','while_loop','repeat_loop'].includes(n.type)) code += `${id}(["${lbl}"])\n`;
else code += `${id}["${lbl}"]\n`;
});

function resolveJoin(id, lbl) {
let cur = id; const seen = new Set([id]);
while (true) {
const s = fwd[cur]; if (!s||!s.length) return null;
const next = s[0].to; const nn = nodeMap[next]; if (!nn) return null;
if (nn.type !== 'join') return { id: next, label: lbl };
if (seen.has(next)) return null; seen.add(next); cur = next;
}
}

reachable.forEach(id => {
const n = nodeMap[id]; if (!n||n.type==='join') return;
(fwd[id]||[]).forEach(e => {
const sn = nodeMap[e.to];
if (sn && sn.type==='join') { const r = resolveJoin(e.to, e.label||''); if (r) code += `${id} -->${r.label?'|'+r.label+'|':''} ${r.id}\n`; }
else code += `${id} -->${e.label?'|'+e.label+'|':''} ${e.to}\n`;
});
});
return code;
}

function updateAllIfElseBlocks() {
document.querySelectorAll('.block-if').forEach(el => {
const header = el.querySelector('.block-if-header'), body = el.querySelector('.block-if-body');
if (!header||!body) return;
const svg = header.querySelector('.if-svg'); if (!svg) return;
const tw = body.offsetWidth; if (!tw) return;
const branches = Array.from(body.children).filter(c => c.classList.contains('block-if-branch'));
if (branches.length !== 2) return;
const cp = (branches[0].offsetWidth / tw) * 100;
const lines = Array.from(svg.querySelectorAll('line'));
const lL = lines.find(l => l.getAttribute('x1')==="0" && l.getAttribute('y1')==="0");
const lR = lines.find(l => l.getAttribute('x1')==="100" && l.getAttribute('y1')==="0");
if (lL) lL.setAttribute("x2", cp); if (lR) lR.setAttribute("x2", cp);
const tc = header.querySelector('.if-condition-text');
if (tc) { tc.style.left = ((50+cp)/2)+'%'; tc.style.transform = 'translateX(-50%)'; tc.style.width = 'auto'; }
});
}

function observeIfResize(container, header, body) {
const svg = header.querySelector('.if-svg'); if (!svg) return;
const update = () => {
const tw = body.offsetWidth; if (!tw) return;
const branches = Array.from(body.children).filter(c => c.classList.contains('block-if-branch'));
if (branches.length !== 2) return;
const cp = (branches[0].offsetWidth / tw) * 100;
const lines = Array.from(svg.querySelectorAll('line'));
const lL = lines.find(l => l.getAttribute('x1')==="0" && l.getAttribute('y1')==="0");
const lR = lines.find(l => l.getAttribute('x1')==="100" && l.getAttribute('y1')==="0");
if (lL) lL.setAttribute("x2", cp); if (lR) lR.setAttribute("x2", cp);
const tc = header.querySelector('.if-condition-text');
if (tc) { tc.style.left = ((50+cp)/2)+'%'; tc.style.transform = 'translateX(-50%)'; tc.style.width = 'auto'; }
};
const obs = new ResizeObserver(update);
obs.observe(body);
body.querySelectorAll('.block-if-branch').forEach(b => obs.observe(b));
setTimeout(update, 50);
}

function observeCaseResize(container, header, body) {
const svg = header.querySelector('.case-svg'); if (!svg) return;
const update = () => {
const tw = body.offsetWidth; if (!tw) return;
const branches = Array.from(body.querySelectorAll('.block-case-branch'));
let cx = 0; const splitY = 60;
branches.forEach((b, i) => {
cx += b.offsetWidth;
if (i < branches.length-1) { const p=(cx/tw)*100; const l=svg.querySelector(`line[data-sep-index="${i+1}"]`); if(l){l.setAttribute("x1",p+"%");l.setAttribute("x2",p+"%");} }
const ld = header.querySelector(`.case-header-label[data-index="${i}"]`);
if (ld) { ld.style.left=((cx-b.offsetWidth)/tw*100)+"%"; ld.style.width=(b.offsetWidth/tw*100)+"%"; }
});
if (branches.length >= 2) {
const p0=(branches[0].offsetWidth/tw)*100, pL=100-(branches[branches.length-1].offsetWidth/tw)*100;
const dL=svg.querySelector('line[x1="0"][y1="0"]'), dR=svg.querySelector('line[x1="100"][y1="0"]');
if(dL)dL.setAttribute("x2",p0+"%"); if(dR)dR.setAttribute("x2",pL+"%");
const lines=Array.from(svg.querySelectorAll('line'));
const h=lines.find(l=>!l.hasAttribute('data-sep-index')&&l.getAttribute('y1')!=="0"&&l.getAttribute('x1')!==l.getAttribute('x2'));
if(h){h.setAttribute("x1",p0+"%");h.setAttribute("x2",pL+"%");}
}
};
new ResizeObserver(update).observe(body);
setTimeout(update, 50);
}
