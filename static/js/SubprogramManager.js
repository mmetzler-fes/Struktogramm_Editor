'use strict';

import { TreeState } from './TreeState.js';

/**
 * SubprogramManager – Verwaltet eigenständige TreeState-Instanzen
 * für jeden Subprogram-Knoten im Hauptprogramm.
 */
export class SubprogramManager {
	constructor() {
		/** @type {Object.<string, TreeState>} */
		this._states = {};
	}

	/**
	 * Gibt den TreeState für einen Subprogram-Knoten zurück.
	 * Erstellt einen neuen leeren TreeState, falls noch keiner existiert.
	 * @param {string} nodeId
	 * @returns {TreeState}
	 */
	getOrCreate(nodeId) {
		if (!this._states[nodeId]) {
			this._states[nodeId] = new TreeState();
		}
		return this._states[nodeId];
	}

	/** @returns {TreeState|null} */
	get(nodeId) {
		return this._states[nodeId] || null;
	}

	/** @returns {boolean} */
	has(nodeId) {
		return Object.prototype.hasOwnProperty.call(this._states, nodeId);
	}

	/** Löscht den TreeState eines Subprogram-Knotens. */
	delete(nodeId) {
		delete this._states[nodeId];
	}

	/** @returns {Array<[string, TreeState]>} */
	entries() {
		return Object.entries(this._states);
	}

	/** Serialisiert alle Subprogramme als { [nodeId]: graphFormat }. */
	toJSON() {
		const result = {};
		for (const [nodeId, state] of Object.entries(this._states)) {
			result[nodeId] = state.toGraphFormat();
		}
		return result;
	}

	fromJSON(data) {
		this._states = {};
		for (const [nodeId, graphData] of Object.entries(data || {})) {
			this._states[nodeId] = TreeState.fromGraphFormat(graphData);
		}
	}
}
