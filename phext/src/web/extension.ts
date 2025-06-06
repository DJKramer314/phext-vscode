import * as vscode from 'vscode';
import { PhextEditorProvider } from './PhextEditorProvider';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(PhextEditorProvider.register(context));
}

export function deactivate() {}
