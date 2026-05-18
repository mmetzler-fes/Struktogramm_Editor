'use strict';

import { BlockFactory } from './BlockFactory.js';

/**
 * BlockManager – Verwaltet Hinzufügen, Löschen und Verschieben von Blöcken.
 * Delegiert Änderungen an den TreeState und löst danach ein Re-Render aus.
 */
export class BlockManager {
	/**
	 * @param {import('./TreeState.js').TreeState} treeState
	 * @param {import('./Renderer.js').Renderer}   renderer
	 */
	constructor(treeState, renderer) {
		this.treeState   = treeState;
		this.renderer    = renderer;
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
		this.renderer.renderInto(this.renderer.lastContainer);
	}

	deleteBlock(id) {
		this.treeState.removeNode(id);
		this.renderer.renderInto(this.renderer.lastContainer);
	}

	moveBlock(id, target) {
		const success = this.treeState.moveNode(id, target);
		this.exitMoveMode();
		if (success) this.renderer.renderInto(this.renderer.lastContainer);
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
		const branches    = found.node.branches;
		const defaultIdx  = branches.findIndex(b => b.label.toLowerCase() === 'default');
		const newBranch   = { label: String(branches.length), children: [] };
		if (defaultIdx !== -1) branches.splice(defaultIdx, 0, newBranch);
		else branches.push(newBranch);
		this.renderer.renderInto(this.renderer.lastContainer);
	}

	deleteCaseOption(blockId, branchIndex) {
		const found = this.treeState.findNode(blockId);
		if (!found || found.node.type !== 'case') return;
		if (found.node.branches.length <= 2) { alert('Mindestens 2 Fälle erforderlich.'); return; }
		found.node.branches.splice(branchIndex, 1);
		this.renderer.renderInto(this.renderer.lastContainer);
	}
}
