import * as vscode from 'vscode';
import { Phext, Coordinate } from './Phext';

export class PhextEditorProvider implements vscode.CustomTextEditorProvider {

    constructor(private readonly context: vscode.ExtensionContext) {}

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        return vscode.window.registerCustomEditorProvider('phext.editor', new PhextEditorProvider(context));
    }

    public async resolveCustomTextEditor(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel): Promise<void> {
        webviewPanel.webview.options = { enableScripts: true };
        const phext = new Phext();

        webviewPanel.webview.html = this.getHtmlForWebview();

        const content = document.getText();
        const coord = new Coordinate("1.1.1/1.1.1/1.1.1");
        const scroll = phext.fetch(content, coord);
        setTimeout(() => {
            webviewPanel.webview.postMessage({ command: 'displayScroll', scroll });
            webviewPanel.webview.postMessage({ command: 'updateLastKnown', scroll });
        }, 50);

        webviewPanel.webview.onDidReceiveMessage(async message => {
            if (message.command === 'navigate') {
                try {
                    const coord = phext.to_coordinate(message.coordinate);
                    const updatedContent = document.getText();
                    const newScroll = phext.fetch(updatedContent, coord);
                    webviewPanel.webview.postMessage({ command: 'displayScroll', scroll: newScroll });
                    webviewPanel.webview.postMessage({ command: 'updateLastKnown', scroll: newScroll });
                } catch (e) {
                    vscode.window.showErrorMessage("Navigation failed: " + e);
                }
            }
            if (message.command === 'saveScroll') {
                try {
                    const docText = document.getText();
                    const coord = phext.to_coordinate(message.coordinate);
                    const updatedContent = phext.replace(docText, coord, message.scroll);
                    if (updatedContent !== docText) {
                        const edit = new vscode.WorkspaceEdit();
                        const range = new vscode.Range(document.positionAt(0), document.positionAt(docText.length));
                        edit.replace(document.uri, range, updatedContent);
                        await vscode.workspace.applyEdit(edit);
                    }
                } catch (e) {
                    vscode.window.showErrorMessage("Save failed: " + e);
                }
            }
        });
    }

    private getHtmlForWebview(): string {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>Phext Editor</title>
            <style>
                :root { color-scheme: light dark; }
                body {
                    font-family: var(--vscode-font-family, sans-serif);
                    margin: 0;
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                }
                .scroll-display {
                    flex-grow: 1;
                    padding: 16px;
                    overflow-y: auto;
                    border-top: 1px solid var(--vscode-editorWidget-border);
                    white-space: pre-wrap;
                }
                .coordinate-bar {
                    background-color: var(--vscode-editorWidget-background);
                    padding: 12px 24px;
                    border-top: 1px solid var(--vscode-editorWidget-border);
                    display: flex;
                    align-items: center;
                }
                .coordinate-bar label {
                    margin-right: 16px;
                    font-weight: bold;
                    font-size: 15px;
                }
                #coordInput {
                    flex-grow: 1;
                    font-size: 14px;
                    height: 30px;
                    padding: 0 8px;
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                }
            </style>
        </head>
        <body>
            <div class="scroll-display" id="scrollDisplay" contenteditable="true"></div>
            <div class="coordinate-bar">
                <label for="coordInput">Coordinate:</label>
                <input id="coordInput" type="text" placeholder="1.1.1/1.1.1/1.1.1" value="1.1.1/1.1.1/1.1.1" />
            </div>
            <script>
                const vscode = acquireVsCodeApi();
                let lastKnownScroll = "";

                const coordInput = document.getElementById("coordInput");

                function isValidCoordinateFormat(coord) {
                    const pattern = /^\\d+\\.\\d+\\.\\d+\\/\\d+\\.\\d+\\.\\d+\\/\\d+\\.\\d+\\.\\d+$/;
                    return pattern.test(coord);
                }

                function sendNavigateIfValid() {
                    const coord = coordInput.value.trim();
                    console.log("[Webview] Coordinate input:", coord);
                    if (isValidCoordinateFormat(coord)) {
                        console.log("[Webview] Sending navigate to:", coord);
                        vscode.postMessage({ command: 'navigate', coordinate: coord });
                    } else {
                        console.log("[Webview] Invalid coordinate");
                    }
                }

                coordInput.addEventListener("input", () => {
                    sendNavigateIfValid();
                });

                coordInput.addEventListener("blur", () => {
                    sendNavigateIfValid();
                });

                coordInput.addEventListener("keydown", e => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        sendNavigateIfValid();
                    }
                });

                document.getElementById("scrollDisplay").addEventListener("input", () => {
                    const currentContent = document.getElementById("scrollDisplay").innerText;
                    if (currentContent !== lastKnownScroll && isValidCoordinateFormat(coordInput.value.trim())) {
                        vscode.postMessage({
                            command: 'saveScroll',
                            coordinate: coordInput.value.trim(),
                            scroll: currentContent
                        });
                    }
                });

                window.addEventListener('message', e => {
                    const m = e.data;
                    if (m.command === 'displayScroll') {
                        document.getElementById("scrollDisplay").innerText = m.scroll || "";
                    }
                    if (m.command === 'updateLastKnown') {
                        lastKnownScroll = m.scroll || "";
                    }
                });
            </script>
        </body>
        </html>`;
    }
}
